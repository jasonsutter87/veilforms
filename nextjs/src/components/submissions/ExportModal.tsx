/**
 * VeilForms - Export Modal Component
 * UI for exporting submissions to CSV or JSON
 */

"use client";

import { useState } from "react";
import {
  exportSubmissions,
  type ExportOptions,
  type ExportSubmission,
  type FormInfo,
} from "@/lib/export";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: ExportSubmission[];
  formInfo: FormInfo;
  privateKey: JsonWebKey | null;
  onRequestKey: () => void;
}

export function ExportModal({
  isOpen,
  onClose,
  submissions,
  formInfo,
  privateKey,
  onRequestKey,
}: ExportModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setError("");

    // Validate that we have a private key
    if (!privateKey) {
      onRequestKey();
      return;
    }

    // Validate date range if enabled
    if (useDateRange) {
      if (!startDate || !endDate) {
        setError("Please provide both start and end dates");
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        setError("Start date must be before end date");
        return;
      }
    }

    setIsExporting(true);

    try {
      const options: ExportOptions = {
        format,
        includeMetadata,
        dateRange: useDateRange
          ? {
              start: new Date(startDate).toISOString(),
              end: new Date(endDate).toISOString(),
            }
          : null,
      };

      // Perform the export
      exportSubmissions(submissions, formInfo, options);

      // Log success to audit trail via API
      try {
        const token = localStorage.getItem("veilforms_token");
        await fetch(`/api/forms/${formInfo.id}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            format,
            submissionCount: submissions.length,
            dateRange: options.dateRange,
          }),
        });
      } catch (auditError) {
        // Don't fail the export if audit logging fails
        console.error("Failed to log export:", auditError);
      }

      // Close modal on success
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setError("");
      onClose();
    }
  };

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-backdrop" onClick={handleClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Export Submissions</h2>
          <button
            className="modal-close"
            onClick={handleClose}
            aria-label="Close"
            disabled={isExporting}
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          {!privateKey && (
            <div className="info-message" style={{ marginBottom: "1rem" }}>
              Please decrypt submissions first before exporting. Click the button below to
              enter your private key.
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="export-format">Export Format</label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              disabled={isExporting}
            >
              <option value="csv">CSV (Excel, Google Sheets)</option>
              <option value="json">JSON</option>
            </select>
            <small>
              {format === "csv"
                ? "Best for spreadsheet analysis in Excel or Google Sheets"
                : "Best for programmatic processing or backup"}
            </small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                disabled={isExporting}
              />
              Include metadata (IP address, user agent)
            </label>
            <small>Additional information about each submission</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={useDateRange}
                onChange={(e) => setUseDateRange(e.target.checked)}
                disabled={isExporting}
              />
              Filter by date range
            </label>
          </div>

          {useDateRange && (
            <div className="date-range-inputs">
              <div className="form-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isExporting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isExporting}
                />
              </div>
            </div>
          )}

          <div className="export-info">
            <p>
              <strong>Total submissions:</strong> {submissions.length}
            </p>
            {!privateKey && (
              <p style={{ color: "var(--color-warning, #ff9800)" }}>
                Submissions must be decrypted before export
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </button>

          {!privateKey ? (
            <button className="btn btn-primary" onClick={onRequestKey}>
              Enter Private Key
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
