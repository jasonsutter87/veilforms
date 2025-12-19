/**
 * VeilForms - Zapier Integration Component
 * UI for connecting forms to Zapier webhooks
 */

"use client";

import { useState, useEffect } from "react";

interface ZapierConnectProps {
  formId: string;
  formName: string;
}

interface ZapierSettings {
  enabled: boolean;
  webhookUrl: string | null;
  connected: boolean;
}

export function ZapierConnect({ formId, formName }: ZapierConnectProps) {
  const [settings, setSettings] = useState<ZapierSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, [formId]);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/forms/${formId}/zapier`);

      if (!response.ok) {
        throw new Error("Failed to load Zapier settings");
      }

      const data = await response.json();
      setSettings(data.zapier);
      setWebhookUrl(data.zapier.webhookUrl || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!webhookUrl.trim()) {
      setError("Please enter a Zapier webhook URL");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setTestResult(null);

      const response = await fetch(`/api/forms/${formId}/zapier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          webhookUrl: webhookUrl.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to connect Zapier");
      }

      const data = await response.json();
      setSettings(data.zapier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Zapier?")) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setTestResult(null);

      const response = await fetch(`/api/forms/${formId}/zapier`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect Zapier");
      }

      setSettings({ enabled: false, webhookUrl: null, connected: false });
      setWebhookUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);

      const response = await fetch(`/api/forms/${formId}/zapier/test`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          message: data.error || "Test failed",
        });
        return;
      }

      setTestResult({
        success: true,
        message: "Test webhook sent successfully! Check your Zap for the test data.",
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="zapier-connect">
        <div className="zapier-loading">
          <div className="spinner"></div>
          <p>Loading Zapier settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="zapier-connect">
      <div className="zapier-header">
        <div className="zapier-logo">
          <ZapierIcon />
        </div>
        <div className="zapier-info">
          <h3>Connect to Zapier</h3>
          <p>
            Automatically send form submissions to 5,000+ apps using Zapier workflows.
          </p>
        </div>
      </div>

      {settings?.connected ? (
        <div className="zapier-connected">
          <div className="status-badge success">
            <CheckIcon />
            <span>Connected</span>
          </div>

          <div className="webhook-display">
            <label>Webhook URL</label>
            <code className="webhook-url">{settings.webhookUrl}</code>
          </div>

          <div className="zapier-actions">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="btn-secondary"
            >
              {testing ? "Sending Test..." : "Send Test"}
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={saving}
              className="btn-danger"
            >
              Disconnect
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.success ? "success" : "error"}`}>
              {testResult.message}
            </div>
          )}
        </div>
      ) : (
        <div className="zapier-setup">
          <div className="setup-steps">
            <h4>Setup Instructions</h4>
            <ol>
              <li>
                Go to{" "}
                <a
                  href="https://zapier.com/app/zaps"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Zapier
                </a>{" "}
                and create a new Zap
              </li>
              <li>Choose "Webhooks by Zapier" as the trigger app</li>
              <li>Select "Catch Hook" as the trigger event</li>
              <li>Copy the webhook URL that Zapier provides</li>
              <li>Paste the webhook URL below and click Connect</li>
            </ol>
          </div>

          <div className="webhook-input-group">
            <label htmlFor="zapier-webhook-url">Zapier Webhook URL</label>
            <input
              id="zapier-webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="webhook-input"
              disabled={saving}
            />
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={saving || !webhookUrl.trim()}
            className="btn-primary"
          >
            {saving ? "Connecting..." : "Connect to Zapier"}
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="zapier-note">
        <InfoIcon />
        <div>
          <strong>Important:</strong> Due to VeilForms' client-side encryption, Zapier
          receives submission metadata only (ID, timestamp, form name). To access
          the full submission data, users will need to click through to your
          VeilForms dashboard.
        </div>
      </div>

      <style jsx>{`
        .zapier-connect {
          max-width: 600px;
          padding: 24px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .zapier-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px 20px;
          color: #6b7280;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .zapier-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
        }

        .zapier-logo {
          flex-shrink: 0;
          padding: 12px;
          background: #ff4a00;
          border-radius: 8px;
        }

        .zapier-info h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .zapier-info p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .zapier-connected,
        .zapier-setup {
          margin-top: 24px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
        }

        .status-badge.success {
          background: #d1fae5;
          color: #065f46;
        }

        .webhook-display {
          margin-bottom: 16px;
        }

        .webhook-display label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .webhook-url {
          display: block;
          width: 100%;
          padding: 10px 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-family: "Monaco", "Courier New", monospace;
          font-size: 13px;
          color: #111827;
          overflow-x: auto;
        }

        .zapier-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .test-result {
          margin-top: 16px;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }

        .test-result.success {
          background: #d1fae5;
          color: #065f46;
        }

        .test-result.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .setup-steps {
          margin-bottom: 24px;
        }

        .setup-steps h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .setup-steps ol {
          margin: 0;
          padding-left: 24px;
          color: #374151;
        }

        .setup-steps li {
          margin-bottom: 8px;
          font-size: 14px;
          line-height: 1.6;
        }

        .setup-steps a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .webhook-input-group {
          margin-bottom: 16px;
        }

        .webhook-input-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .webhook-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          color: #111827;
          transition: border-color 0.2s;
        }

        .webhook-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .webhook-input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f9fafb;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #991b1b;
          font-size: 14px;
        }

        .zapier-note {
          margin-top: 24px;
          padding: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          display: flex;
          gap: 12px;
          font-size: 14px;
          color: #1e40af;
        }

        .zapier-note svg {
          flex-shrink: 0;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

function ZapierIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
