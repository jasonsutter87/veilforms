/**
 * VeilForms - Form Analytics Page
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface AnalyticsData {
  formId: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalViews: number;
    totalSubmissions: number;
    conversionRate: number;
    avgCompletionTimeMs: number;
    deviceBreakdown: {
      desktop: number;
      mobile: number;
      tablet: number;
    };
    topCountries: Array<{ country: string; count: number }>;
    topReferrers: Array<{ referrer: string; count: number }>;
  };
  daily: Array<{
    date: string;
    metrics: {
      views: number;
      submissions: number;
    };
  }>;
}

type DateRange = "7d" | "30d" | "90d" | "custom";

export default function FormAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (dateRange) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "custom":
        return {
          start: customStart || end.toISOString().split("T")[0],
          end: customEnd || end.toISOString().split("T")[0],
        };
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("veilforms_token");
        const { start, end } = getDateRange();

        const response = await fetch(
          `/api/forms/${formId}/analytics?start=${start}&end=${end}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to load analytics");
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [formId, dateRange, customStart, customEnd, router]);

  // Format time
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get max value for chart scaling
  const getMaxDailyValue = () => {
    if (!analytics?.daily) return 0;
    return Math.max(...analytics.daily.map((d) => Math.max(d.metrics.views, d.metrics.submissions)));
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-icon">!</div>
        <h2>Error</h2>
        <p>{error}</p>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const maxValue = getMaxDailyValue();
  const totalDevices =
    analytics.summary.deviceBreakdown.desktop +
    analytics.summary.deviceBreakdown.mobile +
    analytics.summary.deviceBreakdown.tablet;

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <Link href={`/dashboard/forms/${formId}`} className="back-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Form
          </Link>
          <h1>Analytics</h1>
        </div>

        <div className="date-range-selector">
          <button
            className={`range-btn ${dateRange === "7d" ? "active" : ""}`}
            onClick={() => setDateRange("7d")}
          >
            7 Days
          </button>
          <button
            className={`range-btn ${dateRange === "30d" ? "active" : ""}`}
            onClick={() => setDateRange("30d")}
          >
            30 Days
          </button>
          <button
            className={`range-btn ${dateRange === "90d" ? "active" : ""}`}
            onClick={() => setDateRange("90d")}
          >
            90 Days
          </button>
          <button
            className={`range-btn ${dateRange === "custom" ? "active" : ""}`}
            onClick={() => setDateRange("custom")}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {dateRange === "custom" && (
        <div className="custom-date-range">
          <div className="date-input-group">
            <label>Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              max={customEnd || undefined}
            />
          </div>
          <div className="date-input-group">
            <label>End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              min={customStart || undefined}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card">
          <div className="summary-icon views">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-value">{analytics.summary.totalViews.toLocaleString()}</span>
            <span className="summary-label">Total Views</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon submissions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-value">{analytics.summary.totalSubmissions.toLocaleString()}</span>
            <span className="summary-label">Submissions</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon conversion">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-value">{formatPercentage(analytics.summary.conversionRate)}</span>
            <span className="summary-label">Conversion Rate</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon time">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="summary-content">
            <span className="summary-value">{formatTime(analytics.summary.avgCompletionTimeMs)}</span>
            <span className="summary-label">Avg. Completion</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-charts">
        {/* Daily Views/Submissions Chart */}
        <div className="chart-card wide">
          <h3>Views & Submissions Over Time</h3>
          <div className="chart-legend">
            <span className="legend-item views">
              <span className="legend-dot"></span>
              Views
            </span>
            <span className="legend-item submissions">
              <span className="legend-dot"></span>
              Submissions
            </span>
          </div>
          <div className="bar-chart">
            {analytics.daily.map((day, index) => (
              <div key={day.date} className="chart-bar-group">
                <div className="chart-bars">
                  <div
                    className="chart-bar views"
                    style={{
                      height: maxValue > 0 ? `${(day.metrics.views / maxValue) * 100}%` : "0%",
                    }}
                    title={`Views: ${day.metrics.views}`}
                  ></div>
                  <div
                    className="chart-bar submissions"
                    style={{
                      height: maxValue > 0 ? `${(day.metrics.submissions / maxValue) * 100}%` : "0%",
                    }}
                    title={`Submissions: ${day.metrics.submissions}`}
                  ></div>
                </div>
                {(index === 0 || index === analytics.daily.length - 1 || index === Math.floor(analytics.daily.length / 2)) && (
                  <span className="chart-label">
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="chart-card">
          <h3>Device Breakdown</h3>
          {totalDevices > 0 ? (
            <div className="device-breakdown">
              <div className="device-item">
                <div className="device-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div className="device-info">
                  <span className="device-name">Desktop</span>
                  <span className="device-count">{analytics.summary.deviceBreakdown.desktop}</span>
                </div>
                <div className="device-bar-wrapper">
                  <div
                    className="device-bar desktop"
                    style={{
                      width: `${(analytics.summary.deviceBreakdown.desktop / totalDevices) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="device-percent">
                  {formatPercentage((analytics.summary.deviceBreakdown.desktop / totalDevices) * 100)}
                </span>
              </div>

              <div className="device-item">
                <div className="device-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </div>
                <div className="device-info">
                  <span className="device-name">Mobile</span>
                  <span className="device-count">{analytics.summary.deviceBreakdown.mobile}</span>
                </div>
                <div className="device-bar-wrapper">
                  <div
                    className="device-bar mobile"
                    style={{
                      width: `${(analytics.summary.deviceBreakdown.mobile / totalDevices) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="device-percent">
                  {formatPercentage((analytics.summary.deviceBreakdown.mobile / totalDevices) * 100)}
                </span>
              </div>

              <div className="device-item">
                <div className="device-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </div>
                <div className="device-info">
                  <span className="device-name">Tablet</span>
                  <span className="device-count">{analytics.summary.deviceBreakdown.tablet}</span>
                </div>
                <div className="device-bar-wrapper">
                  <div
                    className="device-bar tablet"
                    style={{
                      width: `${(analytics.summary.deviceBreakdown.tablet / totalDevices) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="device-percent">
                  {formatPercentage((analytics.summary.deviceBreakdown.tablet / totalDevices) * 100)}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-chart">No device data available</div>
          )}
        </div>

        {/* Top Referrers */}
        <div className="chart-card">
          <h3>Top Referrers</h3>
          {analytics.summary.topReferrers.length > 0 ? (
            <div className="referrer-list">
              {analytics.summary.topReferrers.slice(0, 5).map((referrer, index) => (
                <div key={referrer.referrer} className="referrer-item">
                  <span className="referrer-rank">{index + 1}</span>
                  <span className="referrer-name">{referrer.referrer}</span>
                  <span className="referrer-count">{referrer.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-chart">No referrer data available</div>
          )}
        </div>

        {/* Top Countries */}
        <div className="chart-card">
          <h3>Top Countries</h3>
          {analytics.summary.topCountries.length > 0 ? (
            <div className="country-list">
              {analytics.summary.topCountries.slice(0, 5).map((country, index) => (
                <div key={country.country} className="country-item">
                  <span className="country-rank">{index + 1}</span>
                  <span className="country-name">{country.country}</span>
                  <span className="country-count">{country.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-chart">No country data available</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .analytics-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-left h1 {
          margin: 0;
          font-size: 1.5rem;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.875rem;
        }

        .back-btn:hover {
          color: var(--text);
        }

        .date-range-selector {
          display: flex;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px;
        }

        .range-btn {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .range-btn:hover {
          background: var(--bg);
        }

        .range-btn.active {
          background: var(--primary);
          color: white;
        }

        .custom-date-range {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .date-input-group label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .date-input-group input {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .analytics-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-icon.views {
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
        }

        .summary-icon.submissions {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .summary-icon.conversion {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .summary-icon.time {
          background: rgba(236, 72, 153, 0.1);
          color: #ec4899;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
        }

        .summary-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text);
        }

        .summary-label {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .analytics-charts {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .chart-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .chart-card.wide {
          grid-column: span 2;
        }

        .chart-card h3 {
          font-size: 1rem;
          margin: 0 0 16px 0;
        }

        .chart-legend {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-item.views .legend-dot {
          background: #6366f1;
        }

        .legend-item.submissions .legend-dot {
          background: #10b981;
        }

        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 200px;
        }

        .chart-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .chart-bars {
          display: flex;
          gap: 2px;
          height: 180px;
          align-items: flex-end;
        }

        .chart-bar {
          width: 8px;
          min-height: 2px;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s;
        }

        .chart-bar.views {
          background: #6366f1;
        }

        .chart-bar.submissions {
          background: #10b981;
        }

        .chart-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .device-breakdown {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .device-item {
          display: grid;
          grid-template-columns: 32px 100px 1fr 50px;
          align-items: center;
          gap: 12px;
        }

        .device-icon {
          color: var(--text-muted);
        }

        .device-info {
          display: flex;
          flex-direction: column;
        }

        .device-name {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .device-count {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .device-bar-wrapper {
          height: 8px;
          background: var(--bg);
          border-radius: 4px;
          overflow: hidden;
        }

        .device-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }

        .device-bar.desktop {
          background: #6366f1;
        }

        .device-bar.mobile {
          background: #10b981;
        }

        .device-bar.tablet {
          background: #f59e0b;
        }

        .device-percent {
          font-size: 0.875rem;
          font-weight: 500;
          text-align: right;
        }

        .referrer-list,
        .country-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .referrer-item,
        .country-item {
          display: grid;
          grid-template-columns: 24px 1fr auto;
          align-items: center;
          gap: 12px;
        }

        .referrer-rank,
        .country-rank {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-align: center;
        }

        .referrer-name,
        .country-name {
          font-size: 0.875rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .referrer-count,
        .country-count {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--primary);
        }

        .empty-chart {
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-icon {
          width: 48px;
          height: 48px;
          background: var(--danger);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: bold;
        }

        @media (max-width: 768px) {
          .analytics-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .analytics-charts {
            grid-template-columns: 1fr;
          }

          .chart-card.wide {
            grid-column: span 1;
          }

          .date-range-selector {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
