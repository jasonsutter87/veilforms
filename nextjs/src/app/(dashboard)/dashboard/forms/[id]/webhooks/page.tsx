/**
 * VeilForms - Webhook Management
 * Configure webhooks for form submissions
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  createdAt: string;
  lastTriggered?: string;
  failureCount: number;
}

interface FormDetails {
  id: string;
  name: string;
}

const WEBHOOK_EVENTS = [
  { id: "submission.created", name: "New Submission", description: "When a new form submission is received" },
  { id: "submission.updated", name: "Submission Updated", description: "When a submission is modified" },
  { id: "submission.deleted", name: "Submission Deleted", description: "When a submission is deleted" },
];

export default function WebhooksPage() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<FormDetails | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    events: ["submission.created"],
  });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [formId]);

  const fetchData = async () => {
    try {
      const [formRes, webhooksRes] = await Promise.all([
        fetch(`/api/forms/${formId}`),
        fetch(`/api/forms/${formId}/webhooks`),
      ]);

      if (formRes.ok) {
        const formData = await formRes.json();
        setForm(formData.form);
      }

      if (webhooksRes.ok) {
        const webhooksData = await webhooksRes.json();
        setWebhooks(webhooksData.webhooks || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/forms/${formId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });

      if (response.ok) {
        const data = await response.json();
        setWebhooks([...webhooks, data.webhook]);
        setShowAddModal(false);
        setNewWebhook({ url: "", events: ["submission.created"] });
      }
    } catch (error) {
      console.error("Failed to add webhook:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWebhook = async (webhookId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/forms/${formId}/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setWebhooks(webhooks.map((w) =>
          w.id === webhookId ? { ...w, enabled } : w
        ));
      }
    } catch (error) {
      console.error("Failed to toggle webhook:", error);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const response = await fetch(`/api/forms/${formId}/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== webhookId));
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingId(webhookId);
    try {
      const response = await fetch(`/api/forms/${formId}/webhooks/${webhookId}/test`, {
        method: "POST",
      });

      if (response.ok) {
        alert("Test webhook sent successfully!");
      } else {
        alert("Failed to send test webhook");
      }
    } catch (error) {
      console.error("Failed to test webhook:", error);
      alert("Failed to send test webhook");
    } finally {
      setTestingId(null);
    }
  };

  const copySecret = async (secret: string, id: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(id);
      setTimeout(() => setCopiedSecret(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading webhooks...</p>
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
    <div className="webhooks-page">
      <style jsx>{`
        .webhooks-page {
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.25rem 0;
        }

        .page-description {
          color: #6b7280;
          margin: 0;
          font-size: 0.875rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }

        .btn-primary {
          background: #4f46e5;
          color: white;
        }

        .btn-primary:hover {
          background: #4338ca;
        }

        .btn-secondary {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #f9fafb;
        }

        .btn-danger {
          color: #dc2626;
          background: transparent;
          border: none;
          padding: 0.5rem;
        }

        .btn-danger:hover {
          background: #fef2f2;
        }

        .webhooks-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .webhook-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
        }

        .webhook-card.disabled {
          opacity: 0.6;
        }

        .webhook-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .webhook-url {
          font-family: monospace;
          font-size: 0.875rem;
          color: #111827;
          word-break: break-all;
        }

        .webhook-toggle {
          position: relative;
          width: 44px;
          height: 24px;
          background: #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .webhook-toggle.active {
          background: #4f46e5;
        }

        .webhook-toggle::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .webhook-toggle.active::after {
          transform: translateX(20px);
        }

        .webhook-events {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .event-tag {
          padding: 0.25rem 0.75rem;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.75rem;
          border-radius: 4px;
        }

        .webhook-meta {
          display: flex;
          gap: 1.5rem;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .webhook-secret {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.75rem;
          margin-bottom: 1rem;
        }

        .webhook-secret code {
          flex: 1;
          color: #374151;
        }

        .copy-btn {
          padding: 0.25rem 0.5rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .webhook-actions {
          display: flex;
          gap: 0.75rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: #f9fafb;
          border: 2px dashed #e5e7eb;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .empty-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .empty-description {
          color: #6b7280;
          margin: 0 0 1.5rem 0;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          width: 100%;
          max-width: 500px;
          margin: 1rem;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 1.5rem 0;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checkbox-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .checkbox-item input {
          margin-top: 0.25rem;
          width: 16px;
          height: 16px;
          accent-color: #4f46e5;
        }

        .checkbox-label {
          font-size: 0.875rem;
          color: #374151;
        }

        .checkbox-description {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        @media (max-width: 640px) {
          .webhooks-page {
            padding: 1rem;
          }

          .page-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Webhooks</h1>
          <p className="page-description">
            {form?.name ? `Configure webhooks for "${form.name}"` : "Configure webhooks for this form"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <h2 className="empty-title">No webhooks configured</h2>
          <p className="empty-description">
            Add a webhook to receive real-time notifications when submissions are received.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            Add Your First Webhook
          </button>
        </div>
      ) : (
        <div className="webhooks-list">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className={`webhook-card ${!webhook.enabled ? "disabled" : ""}`}>
              <div className="webhook-header">
                <div className="webhook-url">{webhook.url}</div>
                <div
                  className={`webhook-toggle ${webhook.enabled ? "active" : ""}`}
                  onClick={() => handleToggleWebhook(webhook.id, !webhook.enabled)}
                />
              </div>

              <div className="webhook-events">
                {webhook.events.map((event) => (
                  <span key={event} className="event-tag">
                    {WEBHOOK_EVENTS.find((e) => e.id === event)?.name || event}
                  </span>
                ))}
              </div>

              <div className="webhook-meta">
                <span>Created: {new Date(webhook.createdAt).toLocaleDateString()}</span>
                {webhook.lastTriggered && (
                  <span>Last triggered: {new Date(webhook.lastTriggered).toLocaleDateString()}</span>
                )}
                {webhook.failureCount > 0 && (
                  <span style={{ color: "#dc2626" }}>Failures: {webhook.failureCount}</span>
                )}
              </div>

              {webhook.secret && (
                <div className="webhook-secret">
                  <span>Secret:</span>
                  <code>{webhook.secret.substring(0, 20)}...</code>
                  <button
                    className="copy-btn"
                    onClick={() => copySecret(webhook.secret!, webhook.id)}
                  >
                    {copiedSecret === webhook.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}

              <div className="webhook-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTestWebhook(webhook.id)}
                  disabled={testingId === webhook.id}
                >
                  {testingId === webhook.id ? "Sending..." : "Send Test"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteWebhook(webhook.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Webhook</h2>

            <div className="form-group">
              <label className="form-label">Webhook URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://your-server.com/webhook"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Events</label>
              <div className="checkbox-group">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewWebhook({
                            ...newWebhook,
                            events: [...newWebhook.events, event.id],
                          });
                        } else {
                          setNewWebhook({
                            ...newWebhook,
                            events: newWebhook.events.filter((id) => id !== event.id),
                          });
                        }
                      }}
                    />
                    <div>
                      <div className="checkbox-label">{event.name}</div>
                      <div className="checkbox-description">{event.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddWebhook}
                disabled={saving || !newWebhook.url || newWebhook.events.length === 0}
              >
                {saving ? "Adding..." : "Add Webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
