/**
 * VeilForms - Form Detail Page
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useDashboardStore, Form, Submission } from "@/store/dashboard";
import { ExportModal } from "@/components/submissions/ExportModal";
import type { ExportSubmission } from "@/lib/export";

// Dynamic import for FormBuilder with SSR disabled and loading state
const FormBuilder = dynamic(
  () => import("@/components/form-builder/FormBuilder").then(mod => ({ default: mod.FormBuilder })),
  {
    ssr: false,
    loading: () => (
      <div className="loading-builder" style={{ padding: "2rem", textAlign: "center" }}>
        <div className="spinner"></div>
        <p>Loading form builder...</p>
      </div>
    ),
  }
);

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ViewMode = "detail" | "submissions" | "builder";

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const {
    currentForm,
    setCurrentForm,
    submissions,
    setSubmissions,
    submissionsLoading,
    setSubmissionsLoading,
    updateForm,
    decryptionKey,
    setDecryptionKey,
    updateSubmissionDecrypted,
  } = useDashboardStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("detail");

  // Settings form state
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "paused">("active");
  const [piiStrip, setPiiStrip] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  // Decrypt modal
  const [decryptModalOpen, setDecryptModalOpen] = useState(false);
  const [decryptKeyInput, setDecryptKeyInput] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [decryptError, setDecryptError] = useState("");

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Load form on mount
  useEffect(() => {
    const loadForm = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("veilforms_token");
        const response = await fetch(`/api/forms/${formId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to load form");
        }

        const data = await response.json();
        setCurrentForm(data.form);
        setFormName(data.form.name);
        setFormStatus(data.form.status || "active");
        setPiiStrip(data.form.settings?.piiStrip || false);
        setWebhookUrl(data.form.settings?.webhookUrl || "");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId, router, setCurrentForm]);

  // Load submissions
  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/submissions/${formId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }

      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Load submissions error:", err);
    }
  };

  // Switch to submissions view
  const handleViewSubmissions = () => {
    setViewMode("submissions");
    loadSubmissions();
  };

  // Save form settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");
    setSaving(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          status: formStatus,
          settings: {
            piiStrip,
            webhookUrl: webhookUrl || null,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      updateForm(formId, {
        name: formName,
        status: formStatus,
        settings: { piiStrip, webhookUrl },
      });
      setSaveSuccess("Settings saved!");
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Decrypt submissions
  const handleDecrypt = async () => {
    setDecryptError("");
    try {
      const key = JSON.parse(decryptKeyInput);

      // Try to import the key to validate it
      await crypto.subtle.importKey(
        "jwk",
        key,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
      );

      if (rememberKey) {
        setDecryptionKey(key);
      }

      // Decrypt all submissions
      for (const submission of submissions) {
        if (submission.encryptedData && !submission.decryptedData) {
          try {
            const decrypted = await decryptSubmission(submission.encryptedData, key);
            updateSubmissionDecrypted(submission.id, decrypted);
          } catch {
            console.error("Failed to decrypt submission:", submission.id);
          }
        }
      }

      setDecryptModalOpen(false);
      setDecryptKeyInput("");
    } catch {
      setDecryptError("Invalid private key format");
    }
  };

  // Decrypt a single submission
  async function decryptSubmission(
    encryptedData: string,
    privateKey: JsonWebKey
  ): Promise<Record<string, unknown>> {
    const key = await crypto.subtle.importKey(
      "jwk",
      privateKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    // Parse the encrypted data (base64 encoded)
    const encrypted = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading form...</p>
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

  if (!currentForm) {
    return null;
  }

  return (
    <div className="form-detail">
      {/* Header */}
      <div className="detail-header">
        <Link href="/dashboard" className="back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Forms
        </Link>
        <div className="detail-actions">
          {viewMode === "detail" && (
            <>
              <button className="btn btn-secondary" onClick={handleViewSubmissions}>
                View Submissions
              </button>
              <button className="btn btn-secondary" onClick={() => router.push(`/dashboard/forms/${formId}/analytics`)}>
                View Analytics
              </button>
              <button className="btn btn-primary" onClick={() => setViewMode("builder")}>
                Edit Form
              </button>
            </>
          )}
          {viewMode === "submissions" && (
            <button className="btn btn-secondary" onClick={() => setViewMode("detail")}>
              Back to Details
            </button>
          )}
          {viewMode === "builder" && (
            <button className="btn btn-secondary" onClick={() => setViewMode("detail")}>
              Back to Details
            </button>
          )}
        </div>
      </div>

      {/* Detail View */}
      {viewMode === "detail" && (
        <>
          {/* Embed Code Section */}
          <div className="detail-section">
            <h3>Embed Code</h3>
            <p className="section-description">
              Add this script to your website to enable form submissions.
            </p>
            <div className="embed-code">
              <pre>{`<!-- Add to your page where you want the form -->
<div id="veilforms-container"></div>

<!-- VeilForms SDK -->
<script src="https://veilforms.com/sdk/veilforms-1.0.0.min.js"></script>
<script>
  const vf = new VeilForms({
    formId: '${currentForm.id}',
    endpoint: 'https://veilforms.com',
    onSubmit: (result) => {
      console.log('Form submitted:', result);
    }
  });

  vf.init('veilforms-container');
</script>`}</pre>
              <button
                className="btn btn-secondary copy-btn"
                onClick={() => copyToClipboard(`<!-- Add to your page where you want the form -->\n<div id="veilforms-container"></div>\n\n<!-- VeilForms SDK -->\n<script src="https://veilforms.com/sdk/veilforms-1.0.0.min.js"></script>\n<script>\n  const vf = new VeilForms({\n    formId: '${currentForm.id}',\n    endpoint: 'https://veilforms.com',\n    onSubmit: (result) => {\n      console.log('Form submitted:', result);\n    }\n  });\n  \n  vf.init('veilforms-container');\n</script>`)}
              >
                Copy
              </button>
            </div>
          </div>

          {/* Public Key Section */}
          <div className="detail-section">
            <h3>Public Key</h3>
            <p className="section-description">
              This key is used to encrypt submissions. Share it in your embed code.
            </p>
            <div className="embed-code">
              <pre>{JSON.stringify(currentForm.publicKey, null, 2)}</pre>
              <button
                className="btn btn-secondary copy-btn"
                onClick={() => copyToClipboard(JSON.stringify(currentForm.publicKey, null, 2))}
              >
                Copy
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="detail-section">
            <h3>Settings</h3>
            <form onSubmit={handleSaveSettings}>
              {saveError && <div className="error-message">{saveError}</div>}
              {saveSuccess && <div className="success-message">{saveSuccess}</div>}

              <div className="form-group">
                <label htmlFor="edit-form-name">Form Name</label>
                <input
                  type="text"
                  id="edit-form-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-form-status">Status</label>
                <select
                  id="edit-form-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as "active" | "paused")}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={piiStrip}
                    onChange={(e) => setPiiStrip(e.target.checked)}
                  />
                  Auto-strip PII before encryption
                </label>
                <small>Automatically detect and redact personal information</small>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Webhook Section */}
          <div className="detail-section">
            <h3>Webhook Configuration</h3>
            <p className="section-description">
              Receive real-time notifications when new submissions arrive.
            </p>
            <div className="form-group">
              <label htmlFor="webhook-url">Webhook URL</label>
              <input
                type="url"
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
              <small>We&apos;ll send a POST request with submission data to this URL</small>
            </div>
          </div>

          {/* Stats */}
          <div className="detail-section">
            <h3>Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{currentForm.submissionCount || 0}</span>
                <span className="stat-label">Total Submissions</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{formatDate(currentForm.createdAt)}</span>
                <span className="stat-label">Created</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  {currentForm.lastSubmissionAt ? formatDate(currentForm.lastSubmissionAt) : "Never"}
                </span>
                <span className="stat-label">Last Submission</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Submissions View */}
      {viewMode === "submissions" && (
        <div className="submissions-view">
          <div className="submissions-header">
            <h3>Submissions ({submissions.length})</h3>
            <div className="submissions-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDecryptModalOpen(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Decrypt
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setExportModalOpen(true)}
                disabled={submissions.length === 0}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
              </button>
            </div>
          </div>

          {submissionsLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div className="submissions-table-wrapper">
              <table className="submissions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td>{formatDateTime(submission.createdAt)}</td>
                      <td className="submission-data">
                        {submission.decryptedData ? (
                          <pre>{JSON.stringify(submission.decryptedData, null, 2)}</pre>
                        ) : (
                          <span className="encrypted-badge">Encrypted</span>
                        )}
                      </td>
                      <td>
                        {submission.decryptedData ? (
                          <span className="status-decrypted">Decrypted</span>
                        ) : (
                          <span className="status-encrypted">Encrypted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Form Builder View */}
      {viewMode === "builder" && currentForm && (
        <FormBuilder
          formId={currentForm.id}
          formName={currentForm.name}
          initialFields={currentForm.fields || []}
          onSave={async (fields) => {
            const token = localStorage.getItem("veilforms_token");
            const response = await fetch(`/api/forms/${currentForm.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ fields }),
            });

            if (!response.ok) {
              throw new Error("Failed to save form");
            }

            const data = await response.json();
            setCurrentForm(data.form);
          }}
          onBack={() => setViewMode("detail")}
        />
      )}

      {/* Decrypt Modal */}
      {decryptModalOpen && (
        <div className="modal" style={{ display: "flex" }}>
          <div className="modal-backdrop" onClick={() => setDecryptModalOpen(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Decrypt Submissions</h2>
              <button className="modal-close" onClick={() => setDecryptModalOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Paste your private key to decrypt submissions. Your key never leaves your browser.</p>
              {decryptError && <div className="error-message">{decryptError}</div>}
              <div className="form-group">
                <label htmlFor="decrypt-key">Private Key (JWK)</label>
                <textarea
                  id="decrypt-key"
                  rows={6}
                  value={decryptKeyInput}
                  onChange={(e) => setDecryptKeyInput(e.target.value)}
                  placeholder='{"kty":"RSA","alg":"RSA-OAEP-256",...}'
                ></textarea>
              </div>
              <label className="remember-key">
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(e) => setRememberKey(e.target.checked)}
                />
                Remember key for this session (stored in memory only)
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDecryptModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleDecrypt}>
                Decrypt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        submissions={
          submissions.map((sub) => ({
            id: sub.id,
            createdAt: sub.createdAt,
            data: sub.decryptedData || {},
            metadata: sub.metadata,
          })) as ExportSubmission[]
        }
        formInfo={{
          id: currentForm.id,
          name: currentForm.name,
        }}
        privateKey={decryptionKey}
        onRequestKey={() => {
          setExportModalOpen(false);
          setDecryptModalOpen(true);
        }}
      />
    </div>
  );
}
