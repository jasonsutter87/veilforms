/**
 * VeilForms - Dashboard Forms Page
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboardStore, Form } from "@/store/dashboard";
import { EmptyState } from "@/components/onboarding/EmptyState";
import { TooltipManager } from "@/components/onboarding/Tooltip";
import { TOOLTIPS } from "@/lib/onboarding";

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const {
    forms,
    formsLoading,
    formsError,
    setForms,
    setFormsLoading,
    setFormsError,
    deleteForm,
  } = useDashboardStore();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormPiiStrip, setNewFormPiiStrip] = useState(false);
  const [newFormWebhook, setNewFormWebhook] = useState("");
  const [createError, setCreateError] = useState("");
  const [privateKeyModal, setPrivateKeyModal] = useState(false);
  const [newPrivateKey, setNewPrivateKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  // Load forms on mount
  useEffect(() => {
    const loadForms = async () => {
      setFormsLoading(true);
      try {
        const token = localStorage.getItem("veilforms_token");
        const response = await fetch("/api/forms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load forms");
        }

        const data = await response.json();
        setForms(data.forms || []);
      } catch (err) {
        setFormsError((err as Error).message);
      }
    };

    loadForms();
  }, [setForms, setFormsLoading, setFormsError]);

  const handleDeleteClick = (form: Form) => {
    setFormToDelete(form);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!formToDelete) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/forms/${formToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete form");
      }

      deleteForm(formToDelete.id);
      setDeleteModalOpen(false);
      setFormToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsCreating(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFormName,
          settings: {
            piiStrip: newFormPiiStrip,
            webhookUrl: newFormWebhook || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create form");
      }

      // Add form to store
      useDashboardStore.getState().addForm(data.form);

      // Show private key modal
      if (data.privateKey) {
        setNewPrivateKey(JSON.stringify(data.privateKey, null, 2));
        setPrivateKeyModal(true);
      }

      // Reset form
      setNewFormName("");
      setNewFormPiiStrip(false);
      setNewFormWebhook("");
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const copyPrivateKey = async () => {
    await navigator.clipboard.writeText(newPrivateKey);
  };

  const downloadPrivateKey = () => {
    const blob = new Blob([newPrivateKey], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veilforms-private-key.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (formsLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading forms...</p>
      </div>
    );
  }

  // Error state
  if (formsError) {
    return (
      <div className="error-state">
        <div className="error-icon">!</div>
        <h2>Something went wrong</h2>
        <p>{formsError}</p>
        <button
          className="btn btn-secondary"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (forms.length === 0) {
    return (
      <>
        <EmptyState
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              width="64"
              height="64"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          }
          title="No forms yet"
          description="Create your first privacy-first form to get started."
          action={{
            label: "Create Form",
            onClick: () => setCreateModalOpen(true),
          }}
          secondaryAction={{
            label: "View Templates",
            href: "/templates",
          }}
        />

        {/* Create Form Modal */}
        {createModalOpen && (
          <CreateFormModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSubmit={handleCreateForm}
            isCreating={isCreating}
            error={createError}
            formName={newFormName}
            setFormName={setNewFormName}
            piiStrip={newFormPiiStrip}
            setPiiStrip={setNewFormPiiStrip}
            webhook={newFormWebhook}
            setWebhook={setNewFormWebhook}
          />
        )}

        {/* Private Key Modal */}
        {privateKeyModal && (
          <PrivateKeyModal
            isOpen={privateKeyModal}
            privateKey={newPrivateKey}
            onCopy={copyPrivateKey}
            onDownload={downloadPrivateKey}
            keySaved={keySaved}
            setKeySaved={setKeySaved}
            onClose={() => {
              setPrivateKeyModal(false);
              setKeySaved(false);
            }}
          />
        )}
      </>
    );
  }

  // Forms grid
  return (
    <>
      {/* Show tooltips for first-time users */}
      <TooltipManager tooltips={TOOLTIPS.dashboard} active={forms.length > 0} />

      <div className="forms-grid">
        {forms.map((form) => (
          <div key={form.id} className="form-card">
            <div className="form-card-header">
              <h3 className="form-card-title">{form.name}</h3>
              <span className={`form-card-status ${form.status || "active"}`}>
                {form.status || "Active"}
              </span>
            </div>
            <div className="form-card-stats">
              <div className="form-stat">
                <span className="stat-value">{form.submissionCount || 0}</span>
                <span className="stat-label">Submissions</span>
              </div>
              <div className="form-stat">
                <span className="stat-value stat-time">
                  {form.lastSubmissionAt
                    ? formatRelativeTime(form.lastSubmissionAt)
                    : "Never"}
                </span>
                <span className="stat-label">Last submission</span>
              </div>
            </div>
            <div className="form-card-footer">
              <span>Created {formatDate(form.createdAt)}</span>
              <div className="form-card-actions">
                <Link
                  href={`/dashboard/forms/${form.id}`}
                  className="btn-view"
                  title="View form"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </Link>
                <button
                  className="btn-delete"
                  title="Delete"
                  onClick={() => handleDeleteClick(form)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add new form card */}
        <button
          className="form-card form-card-new"
          onClick={() => setCreateModalOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="48"
            height="48"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Create New Form</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && formToDelete && (
        <div className="modal" style={{ display: "flex" }}>
          <div
            className="modal-backdrop"
            onClick={() => setDeleteModalOpen(false)}
          ></div>
          <div className="modal-content modal-danger">
            <div className="modal-header">
              <h2>Delete Form</h2>
              <button
                className="modal-close"
                onClick={() => setDeleteModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{" "}
                <strong>{formToDelete.name}</strong>?
              </p>
              <p className="text-muted">
                This will also delete all submissions. This action cannot be
                undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {createModalOpen && (
        <CreateFormModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreateForm}
          isCreating={isCreating}
          error={createError}
          formName={newFormName}
          setFormName={setNewFormName}
          piiStrip={newFormPiiStrip}
          setPiiStrip={setNewFormPiiStrip}
          webhook={newFormWebhook}
          setWebhook={setNewFormWebhook}
        />
      )}

      {/* Private Key Modal */}
      {privateKeyModal && (
        <PrivateKeyModal
          isOpen={privateKeyModal}
          privateKey={newPrivateKey}
          onCopy={copyPrivateKey}
          onDownload={downloadPrivateKey}
          keySaved={keySaved}
          setKeySaved={setKeySaved}
          onClose={() => {
            setPrivateKeyModal(false);
            setKeySaved(false);
          }}
        />
      )}
    </>
  );
}

// Create Form Modal Component
function CreateFormModal({
  isOpen,
  onClose,
  onSubmit,
  isCreating,
  error,
  formName,
  setFormName,
  piiStrip,
  setPiiStrip,
  webhook,
  setWebhook,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isCreating: boolean;
  error: string;
  formName: string;
  setFormName: (name: string) => void;
  piiStrip: boolean;
  setPiiStrip: (strip: boolean) => void;
  webhook: string;
  setWebhook: (url: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Form</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={onSubmit} id="create-form-form">
            <div className="form-group">
              <label htmlFor="form-name">Form Name</label>
              <input
                type="text"
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g., Contact Form"
                maxLength={100}
              />
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
            <div className="form-group">
              <label htmlFor="form-webhook">Webhook URL (optional)</label>
              <input
                type="url"
                id="form-webhook"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
              <small>Get notified when submissions arrive</small>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-form-form"
            className="btn btn-primary"
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create Form"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Private Key Modal Component
function PrivateKeyModal({
  isOpen,
  privateKey,
  onCopy,
  onDownload,
  keySaved,
  setKeySaved,
  onClose,
}: {
  isOpen: boolean;
  privateKey: string;
  onCopy: () => void;
  onDownload: () => void;
  keySaved: boolean;
  setKeySaved: (saved: boolean) => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-backdrop"></div>
      <div className="modal-content modal-warning">
        <div className="modal-header">
          <h2>Save Your Private Key</h2>
        </div>
        <div className="modal-body">
          <div className="warning-box">
            <strong>This is the only time you&apos;ll see this key!</strong>
            <p>
              We cannot recover your private key. If you lose it, you will not
              be able to decrypt your submissions.
            </p>
          </div>
          <div className="form-group">
            <label>Private Key (JWK format)</label>
            <textarea readOnly rows={8} value={privateKey}></textarea>
          </div>
          <div className="key-actions">
            <button className="btn btn-secondary" onClick={onCopy}>
              Copy to Clipboard
            </button>
            <button className="btn btn-secondary" onClick={onDownload}>
              Download as File
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <label className="confirm-save">
            <input
              type="checkbox"
              checked={keySaved}
              onChange={(e) => setKeySaved(e.target.checked)}
            />
            I have saved my private key securely
          </label>
          <button
            className="btn btn-primary"
            disabled={!keySaved}
            onClick={onClose}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
