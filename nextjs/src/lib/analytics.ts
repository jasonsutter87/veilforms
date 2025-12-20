import { getStore } from '@netlify/blobs';

export interface FormAnalytics {
  formId: string;
  date: string; // YYYY-MM-DD
  metrics: {
    views: number;
    submissions: number;
    uniqueVisitors: number;
    avgCompletionTimeMs: number;
    completionTimes: number[]; // For calculating averages
    deviceBreakdown: {
      desktop: number;
      mobile: number;
      tablet: number;
    };
    browserBreakdown: Record<string, number>;
    countryBreakdown: Record<string, number>;
    referrerBreakdown: Record<string, number>;
    fieldDropoff: Record<string, number>; // fieldName -> count of users who stopped there
  };
}

const STORES = {
  ANALYTICS: 'vf-analytics',
};

function store() {
  return getStore({ name: STORES.ANALYTICS, consistency: 'eventual' });
}

function getAnalyticsKey(formId: string, date: string): string {
  return `${formId}:${date}`;
}

export async function getFormAnalytics(formId: string, date: string): Promise<FormAnalytics | null> {
  const analytics = store();
  const key = getAnalyticsKey(formId, date);
  return (await analytics.get(key, { type: 'json' })) as FormAnalytics | null;
}

export async function incrementFormView(formId: string, metadata: {
  userAgent?: string;
  country?: string;
  referrer?: string;
}): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const key = getAnalyticsKey(formId, date);
  const analytics = store();

  let data = await getFormAnalytics(formId, date);

  if (!data) {
    data = createEmptyAnalytics(formId, date);
  }

  data.metrics.views++;

  // Device detection
  const device = detectDevice(metadata.userAgent || '');
  data.metrics.deviceBreakdown[device]++;

  // Browser detection
  const browser = detectBrowser(metadata.userAgent || '');
  data.metrics.browserBreakdown[browser] = (data.metrics.browserBreakdown[browser] || 0) + 1;

  // Country
  if (metadata.country) {
    data.metrics.countryBreakdown[metadata.country] = (data.metrics.countryBreakdown[metadata.country] || 0) + 1;
  }

  // Referrer
  if (metadata.referrer) {
    const referrerDomain = extractDomain(metadata.referrer);
    data.metrics.referrerBreakdown[referrerDomain] = (data.metrics.referrerBreakdown[referrerDomain] || 0) + 1;
  }

  await analytics.setJSON(key, data);
}

export async function recordSubmission(formId: string, completionTimeMs: number): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const key = getAnalyticsKey(formId, date);
  const analytics = store();

  let data = await getFormAnalytics(formId, date);

  if (!data) {
    data = createEmptyAnalytics(formId, date);
  }

  data.metrics.submissions++;
  data.metrics.completionTimes.push(completionTimeMs);
  data.metrics.avgCompletionTimeMs = calculateAverage(data.metrics.completionTimes);

  await analytics.setJSON(key, data);
}

export async function getFormAnalyticsRange(
  formId: string,
  startDate: string,
  endDate: string
): Promise<FormAnalytics[]> {
  const results: FormAnalytics[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().slice(0, 10);
    const data = await getFormAnalytics(formId, dateStr);
    if (data) {
      results.push(data);
    }
  }

  return results;
}

export function aggregateAnalytics(analytics: FormAnalytics[]): {
  totalViews: number;
  totalSubmissions: number;
  conversionRate: number;
  avgCompletionTimeMs: number;
  deviceBreakdown: FormAnalytics['metrics']['deviceBreakdown'];
  topCountries: Array<{ country: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
} {
  const totals = {
    views: 0,
    submissions: 0,
    completionTimes: [] as number[],
    devices: { desktop: 0, mobile: 0, tablet: 0 },
    countries: {} as Record<string, number>,
    referrers: {} as Record<string, number>,
  };

  for (const day of analytics) {
    totals.views += day.metrics.views;
    totals.submissions += day.metrics.submissions;
    totals.completionTimes.push(...day.metrics.completionTimes);

    totals.devices.desktop += day.metrics.deviceBreakdown.desktop;
    totals.devices.mobile += day.metrics.deviceBreakdown.mobile;
    totals.devices.tablet += day.metrics.deviceBreakdown.tablet;

    for (const [country, count] of Object.entries(day.metrics.countryBreakdown)) {
      totals.countries[country] = (totals.countries[country] || 0) + count;
    }

    for (const [referrer, count] of Object.entries(day.metrics.referrerBreakdown)) {
      totals.referrers[referrer] = (totals.referrers[referrer] || 0) + count;
    }
  }

  return {
    totalViews: totals.views,
    totalSubmissions: totals.submissions,
    conversionRate: totals.views > 0 ? (totals.submissions / totals.views) * 100 : 0,
    avgCompletionTimeMs: calculateAverage(totals.completionTimes),
    deviceBreakdown: totals.devices,
    topCountries: Object.entries(totals.countries)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topReferrers: Object.entries(totals.referrers)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

// Helper functions
function createEmptyAnalytics(formId: string, date: string): FormAnalytics {
  return {
    formId,
    date,
    metrics: {
      views: 0,
      submissions: 0,
      uniqueVisitors: 0,
      avgCompletionTimeMs: 0,
      completionTimes: [],
      deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
      browserBreakdown: {},
      countryBreakdown: {},
      referrerBreakdown: {},
      fieldDropoff: {},
    },
  };
}

function detectDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('edg')) return 'Edge';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
  return 'Other';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'direct';
  }
}

function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}
