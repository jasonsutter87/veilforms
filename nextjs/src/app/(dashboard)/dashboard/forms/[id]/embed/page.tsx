/**
 * VeilForms - Form Embed Code Generator
 * Generate embed codes for forms
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface FormDetails {
  id: string;
  name: string;
  publicKey: object;
}

type EmbedType = "script" | "iframe" | "react" | "html";

export default function FormEmbedPage() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<FormDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedType, setEmbedType] = useState<EmbedType>("script");
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    width: "100%",
    height: "500",
    theme: "light" as "light" | "dark" | "auto",
    hideTitle: false,
    redirectUrl: "",
  });

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://veilforms.com";

  useEffect(() => {
    fetchForm();
  }, [formId]);

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/forms/${formId}`);
      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
      }
    } catch (error) {
      console.error("Failed to fetch form:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmbedCode = (): string => {
    const optionsStr = Object.entries(options)
      .filter(([_, v]) => v !== "" && v !== false)
      .map(([k, v]) => {
        if (typeof v === "boolean") return `data-${k.toLowerCase()}="true"`;
        return `data-${k.toLowerCase()}="${v}"`;
      })
      .join("\n    ");

    switch (embedType) {
      case "script":
        return `<!-- VeilForms Embed -->
<div id="veilforms-${formId}"></div>
<script
    src="${baseUrl}/sdk/veilforms.min.js"
    data-form-id="${formId}"
    data-container="#veilforms-${formId}"
    ${optionsStr}
    async>
</script>`;

      case "iframe":
        return `<!-- VeilForms Embed (iframe) -->
<iframe
    src="${baseUrl}/embed/${formId}?theme=${options.theme}${options.hideTitle ? "&hideTitle=true" : ""}${options.redirectUrl ? `&redirectUrl=${encodeURIComponent(options.redirectUrl)}` : ""}"
    width="${options.width}"
    height="${options.height}px"
    frameborder="0"
    style="border: none; max-width: 100%;">
</iframe>`;

      case "react":
        return `// npm install @veilforms/react
import { VeilForm } from '@veilforms/react';

function MyForm() {
  return (
    <VeilForm
      formId="${formId}"
      theme="${options.theme}"
      ${options.hideTitle ? "hideTitle" : ""}
      ${options.redirectUrl ? `redirectUrl="${options.redirectUrl}"` : ""}
      onSubmit={(data) => console.log('Submitted:', data)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}`;

      case "html":
        return `<!-- VeilForms Direct Link -->
<a href="${baseUrl}/f/${formId}" target="_blank" rel="noopener">
  ${form?.name || "Open Form"}
</a>

<!-- Or as a button -->
<button onclick="window.open('${baseUrl}/f/${formId}', '_blank')">
  ${form?.name || "Open Form"}
</button>`;

      default:
        return "";
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateEmbedCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading...</p>
        <style jsx>{`
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            color: #6b7280;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e5e7eb;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="embed-page">
      <style jsx>{`
        .embed-page {
          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .page-description {
          color: #6b7280;
          margin: 0;
        }

        .embed-types {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .embed-type-btn {
          padding: 0.75rem 1.25rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .embed-type-btn:hover {
          border-color: #4f46e5;
          color: #4f46e5;
        }

        .embed-type-btn.active {
          border-color: #4f46e5;
          background: #eef2ff;
          color: #4f46e5;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 2rem;
        }

        .code-section {
          background: #1f2937;
          border-radius: 12px;
          overflow: hidden;
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: #111827;
          border-bottom: 1px solid #374151;
        }

        .code-title {
          font-size: 0.875rem;
          color: #9ca3af;
          margin: 0;
        }

        .copy-btn {
          padding: 0.5rem 1rem;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .copy-btn:hover {
          background: #4338ca;
        }

        .copy-btn.copied {
          background: #10b981;
        }

        .code-content {
          padding: 1.5rem;
          overflow-x: auto;
        }

        .code-content pre {
          margin: 0;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #e5e7eb;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .options-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
        }

        .options-title {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 1.5rem 0;
        }

        .option-group {
          margin-bottom: 1.25rem;
        }

        .option-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .option-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          transition: all 0.15s;
        }

        .option-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .option-select {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          background: white;
          cursor: pointer;
        }

        .option-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .option-checkbox input {
          width: 18px;
          height: 18px;
          accent-color: #4f46e5;
        }

        .preview-section {
          margin-top: 2rem;
          padding: 2rem;
          background: #f9fafb;
          border: 2px dashed #e5e7eb;
          border-radius: 12px;
          text-align: center;
        }

        .preview-title {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 1rem 0;
        }

        .preview-link {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 500;
        }

        .preview-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .embed-page {
            padding: 1rem;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .options-section {
            order: -1;
          }
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Embed Form: {form?.name}</h1>
        <p className="page-description">
          Choose how you want to embed this form on your website
        </p>
      </div>

      <div className="embed-types">
        <button
          className={`embed-type-btn ${embedType === "script" ? "active" : ""}`}
          onClick={() => setEmbedType("script")}
        >
          JavaScript SDK
        </button>
        <button
          className={`embed-type-btn ${embedType === "iframe" ? "active" : ""}`}
          onClick={() => setEmbedType("iframe")}
        >
          iframe
        </button>
        <button
          className={`embed-type-btn ${embedType === "react" ? "active" : ""}`}
          onClick={() => setEmbedType("react")}
        >
          React Component
        </button>
        <button
          className={`embed-type-btn ${embedType === "html" ? "active" : ""}`}
          onClick={() => setEmbedType("html")}
        >
          Direct Link
        </button>
      </div>

      <div className="content-grid">
        <div className="code-section">
          <div className="code-header">
            <span className="code-title">
              {embedType === "script" && "JavaScript Embed Code"}
              {embedType === "iframe" && "iframe Embed Code"}
              {embedType === "react" && "React Component"}
              {embedType === "html" && "HTML Link"}
            </span>
            <button
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={copyToClipboard}
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>
          <div className="code-content">
            <pre>{generateEmbedCode()}</pre>
          </div>
        </div>

        <div className="options-section">
          <h3 className="options-title">Embed Options</h3>

          {(embedType === "iframe" || embedType === "script") && (
            <>
              <div className="option-group">
                <label className="option-label">Width</label>
                <input
                  type="text"
                  className="option-input"
                  value={options.width}
                  onChange={(e) =>
                    setOptions({ ...options, width: e.target.value })
                  }
                  placeholder="100% or 600px"
                />
              </div>

              <div className="option-group">
                <label className="option-label">Height (px)</label>
                <input
                  type="text"
                  className="option-input"
                  value={options.height}
                  onChange={(e) =>
                    setOptions({ ...options, height: e.target.value })
                  }
                  placeholder="500"
                />
              </div>
            </>
          )}

          <div className="option-group">
            <label className="option-label">Theme</label>
            <select
              className="option-select"
              value={options.theme}
              onChange={(e) =>
                setOptions({
                  ...options,
                  theme: e.target.value as "light" | "dark" | "auto",
                })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="option-group">
            <label className="option-checkbox">
              <input
                type="checkbox"
                checked={options.hideTitle}
                onChange={(e) =>
                  setOptions({ ...options, hideTitle: e.target.checked })
                }
              />
              <span>Hide form title</span>
            </label>
          </div>

          <div className="option-group">
            <label className="option-label">Redirect URL (after submit)</label>
            <input
              type="text"
              className="option-input"
              value={options.redirectUrl}
              onChange={(e) =>
                setOptions({ ...options, redirectUrl: e.target.value })
              }
              placeholder="https://example.com/thank-you"
            />
          </div>
        </div>
      </div>

      <div className="preview-section">
        <p className="preview-title">Preview your form</p>
        <a
          href={`/f/${formId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="preview-link"
        >
          Open form in new tab &rarr;
        </a>
      </div>
    </div>
  );
}
