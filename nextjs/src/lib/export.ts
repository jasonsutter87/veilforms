/**
 * VeilForms - Export Utilities
 * Client-side CSV and JSON export for decrypted submissions
 */

export interface ExportOptions {
  format: "csv" | "json";
  includeMetadata: boolean;
  dateRange?: {
    start: string;
    end: string;
  } | null;
}

export interface ExportSubmission {
  id: string;
  createdAt: string;
  data: Record<string, unknown>;
  metadata?: {
    submittedAt?: string;
    userAgent?: string;
    ip?: string;
  };
}

export interface FormInfo {
  id: string;
  name: string;
}

/**
 * Escape CSV field value
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // Handle arrays (e.g., multi-select checkboxes)
  if (Array.isArray(value)) {
    str = value.join("; ");
  }

  // Handle objects
  if (typeof value === "object" && !Array.isArray(value)) {
    str = JSON.stringify(value);
  }

  // Escape quotes by doubling them
  str = str.replace(/"/g, '""');

  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    str = `"${str}"`;
  }

  return str;
}

/**
 * Extract all unique field names from submissions
 */
function extractFieldNames(submissions: ExportSubmission[]): string[] {
  const fieldSet = new Set<string>();

  for (const submission of submissions) {
    if (submission.data) {
      Object.keys(submission.data).forEach((key) => fieldSet.add(key));
    }
  }

  return Array.from(fieldSet).sort();
}

/**
 * Generate CSV from submissions
 */
export function generateCSV(
  submissions: ExportSubmission[],
  includeMetadata: boolean
): string {
  if (submissions.length === 0) {
    return "No submissions to export";
  }

  const fieldNames = extractFieldNames(submissions);

  // Build header row
  const headers: string[] = ["submission_id", "submitted_at"];

  if (includeMetadata) {
    headers.push("user_agent", "ip_address");
  }

  headers.push(...fieldNames);

  // Build data rows
  const rows: string[][] = [headers];

  for (const submission of submissions) {
    const row: string[] = [
      escapeCsvValue(submission.id),
      escapeCsvValue(submission.createdAt || submission.metadata?.submittedAt || ""),
    ];

    if (includeMetadata) {
      row.push(
        escapeCsvValue(submission.metadata?.userAgent || ""),
        escapeCsvValue(submission.metadata?.ip || "")
      );
    }

    // Add field values in order
    for (const fieldName of fieldNames) {
      row.push(escapeCsvValue(submission.data[fieldName]));
    }

    rows.push(row);
  }

  // Convert to CSV string
  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Generate JSON from submissions
 */
export function generateJSON(
  submissions: ExportSubmission[],
  formInfo: FormInfo,
  includeMetadata: boolean
): string {
  const exportData = {
    form: formInfo,
    exportedAt: new Date().toISOString(),
    totalSubmissions: submissions.length,
    submissions: submissions.map((sub) => {
      const result: Record<string, unknown> = {
        id: sub.id,
        submittedAt: sub.createdAt || sub.metadata?.submittedAt,
        data: sub.data,
      };

      if (includeMetadata && sub.metadata) {
        result.metadata = {
          userAgent: sub.metadata.userAgent,
          ip: sub.metadata.ip,
        };
      }

      return result;
    }),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Filter submissions by date range
 */
export function filterByDateRange(
  submissions: ExportSubmission[],
  dateRange: { start: string; end: string } | null
): ExportSubmission[] {
  if (!dateRange) {
    return submissions;
  }

  const startTime = new Date(dateRange.start).getTime();
  const endTime = new Date(dateRange.end).getTime();

  return submissions.filter((sub) => {
    const submittedAt = sub.createdAt || sub.metadata?.submittedAt;
    if (!submittedAt) return false;

    const time = new Date(submittedAt).getTime();
    return time >= startTime && time <= endTime;
  });
}

/**
 * Trigger browser download of exported data
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Generate filename for export
 */
export function generateFilename(formName: string, format: "csv" | "json"): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedName = formName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${sanitizedName}-submissions-${timestamp}.${format}`;
}

/**
 * Main export function - handles the full export flow
 */
export function exportSubmissions(
  submissions: ExportSubmission[],
  formInfo: FormInfo,
  options: ExportOptions
): void {
  // Filter by date range if provided
  const filtered = filterByDateRange(submissions, options.dateRange || null);

  if (filtered.length === 0) {
    throw new Error("No submissions match the selected date range");
  }

  // Generate content based on format
  let content: string;
  let mimeType: string;

  if (options.format === "csv") {
    content = generateCSV(filtered, options.includeMetadata);
    mimeType = "text/csv;charset=utf-8;";
  } else {
    content = generateJSON(filtered, formInfo, options.includeMetadata);
    mimeType = "application/json;charset=utf-8;";
  }

  // Generate filename and trigger download
  const filename = generateFilename(formInfo.name, options.format);
  downloadFile(content, filename, mimeType);
}
