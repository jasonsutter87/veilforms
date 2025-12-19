/**
 * VeilForms - Preview Modal Component
 * Shows form preview with device selection and shareable link
 */

"use client";

import { useState, useEffect } from "react";
import type { FormField } from "@/store/dashboard";
import { DeviceFrame, DeviceType } from "./DeviceFrame";
import { FormPreviewRenderer } from "./FormPreviewRenderer";

interface PreviewModalProps {
  formId: string;
  formName: string;
  fields: FormField[];
  isOpen: boolean;
  onClose: () => void;
}

export function PreviewModal({
  formId,
  formName,
  fields,
  isOpen,
  onClose,
}: PreviewModalProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);

  // Generate preview token when share link is requested
  useEffect(() => {
    if (showShareLink && !previewUrl) {
      generatePreviewToken();
    }
  }, [showShareLink, previewUrl]);

  const generatePreviewToken = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/forms/${formId}/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate preview token");
      }

      const data = await response.json();
      setPreviewUrl(data.url);
    } catch (err) {
      console.error("Error generating preview token:", err);
      alert("Failed to generate preview link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!previewUrl) return;

    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy link. Please copy manually.");
    }
  };

  const handleOpenInNewTab = () => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title">
            <h2>Form Preview</h2>
            <p>Preview how your form will look to respondents</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close preview">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Device Selector */}
        <div className="preview-controls">
          <div className="device-selector">
            <button
              className={`device-button ${device === "desktop" ? "active" : ""}`}
              onClick={() => setDevice("desktop")}
              title="Desktop view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </button>
            <button
              className={`device-button ${device === "tablet" ? "active" : ""}`}
              onClick={() => setDevice("tablet")}
              title="Tablet view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </button>
            <button
              className={`device-button ${device === "mobile" ? "active" : ""}`}
              onClick={() => setDevice("mobile")}
              title="Mobile view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setShowShareLink(!showShareLink)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Share Preview Link
          </button>
        </div>

        {/* Share Link Section */}
        {showShareLink && (
          <div className="share-section">
            {loading ? (
              <p>Generating preview link...</p>
            ) : previewUrl ? (
              <>
                <div className="share-info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Link expires in 24 hours. Anyone with this link can preview the form.</span>
                </div>
                <div className="share-link">
                  <input
                    type="text"
                    value={previewUrl}
                    readOnly
                    className="share-input"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleCopyLink}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleOpenInNewTab}
                  >
                    Open
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Preview Banner */}
        <div className="preview-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          PREVIEW MODE - No data will be submitted
        </div>

        {/* Preview Content */}
        <div className="preview-content">
          <DeviceFrame device={device}>
            <FormPreviewRenderer
              formName={formName}
              fields={fields}
              isPreview={true}
            />
          </DeviceFrame>
        </div>
      </div>

      <style jsx>{`
        .preview-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .preview-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 1400px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                      0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .preview-title h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
          color: #1a1a1a;
        }

        .preview-title p {
          font-size: 0.875rem;
          color: #666;
          margin: 0;
        }

        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 6px;
          color: #666;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: #f5f5f5;
          color: #1a1a1a;
        }

        .preview-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          gap: 1rem;
        }

        .device-selector {
          display: flex;
          gap: 0.5rem;
        }

        .device-button {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          color: #666;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .device-button:hover {
          border-color: #9ca3af;
          color: #1a1a1a;
        }

        .device-button.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .share-section {
          padding: 1rem 1.5rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .share-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          color: #666;
          font-size: 0.875rem;
        }

        .share-link {
          display: flex;
          gap: 0.5rem;
        }

        .share-input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: monospace;
          background: white;
        }

        .preview-banner {
          background: #fef3c7;
          color: #92400e;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
          font-size: 0.875rem;
          border-bottom: 1px solid #fde68a;
        }

        .preview-content {
          flex: 1;
          overflow: hidden;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: white;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        @media (max-width: 768px) {
          .preview-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .preview-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .device-selector {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
