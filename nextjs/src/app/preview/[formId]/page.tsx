/**
 * VeilForms - Public Preview Page
 * Displays form preview with token-based authentication
 */

"use client";

import { use, useEffect, useState } from "react";
import { FormPreviewRenderer } from "@/components/form-builder/FormPreviewRenderer";
import type { FormField } from "@/store/dashboard";

interface PreviewPageProps {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ token?: string }>;
}

interface FormData {
  id: string;
  name: string;
  status: string;
  fields: FormField[];
}

export default function PreviewPage(props: PreviewPageProps) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const { formId } = params;
  const { token } = searchParams;

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!token) {
        setError("Preview token is required");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/forms/${formId}/preview?token=${encodeURIComponent(token)}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load preview");
        }

        const data = await response.json();
        setFormData(data);
      } catch (err) {
        console.error("Preview fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load form preview");
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [formId, token]);

  if (loading) {
    return (
      <div className="preview-page">
        <div className="preview-loading">
          <div className="spinner"></div>
          <p>Loading preview...</p>
        </div>

        <style jsx>{`
          .preview-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f9fafb;
          }

          .preview-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            color: #666;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-page">
        <div className="preview-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2>Preview Unavailable</h2>
          <p>{error}</p>
          <p className="error-hint">
            {error.includes("token") || error.includes("expired")
              ? "The preview link may have expired (24 hour limit). Please request a new preview link from the form builder."
              : "Please check the preview link and try again."}
          </p>
        </div>

        <style jsx>{`
          .preview-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f9fafb;
            padding: 2rem;
          }

          .preview-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            text-align: center;
            max-width: 500px;
          }

          .preview-error svg {
            color: #ef4444;
          }

          .preview-error h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0;
          }

          .preview-error p {
            color: #666;
            margin: 0;
          }

          .error-hint {
            font-size: 0.875rem;
            padding: 1rem;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 6px;
            color: #c00;
          }
        `}</style>
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  return (
    <div className="preview-page">
      {/* Preview Banner */}
      <div className="preview-banner">
        <div className="banner-content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <div>
            <strong>PREVIEW MODE</strong>
            <span className="banner-divider">|</span>
            <span>No data will be submitted</span>
          </div>
        </div>
      </div>

      {/* Form Status Warning */}
      {formData.status === "paused" && (
        <div className="status-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>This form is currently paused and not accepting submissions.</span>
        </div>
      )}

      {/* Form Preview */}
      <div className="preview-container">
        <FormPreviewRenderer
          formName={formData.name}
          fields={formData.fields}
          isPreview={true}
        />
      </div>

      <style jsx>{`
        .preview-page {
          min-height: 100vh;
          background: #f9fafb;
        }

        .preview-banner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .banner-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .banner-content > div {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .banner-divider {
          opacity: 0.5;
          margin: 0 0.25rem;
        }

        .status-warning {
          max-width: 1200px;
          margin: 1.5rem auto 0;
          padding: 1rem 1.5rem;
          background: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 8px;
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .preview-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        @media (max-width: 768px) {
          .banner-content > div {
            flex-wrap: wrap;
          }

          .banner-divider {
            display: none;
          }

          .status-warning {
            margin: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
