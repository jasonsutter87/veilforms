/**
 * VeilForms - Integrations Dashboard
 * Manage CRM and third-party integrations
 */

"use client";

import { useState, useEffect } from "react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "disconnected" | "coming_soon";
  category: "crm" | "automation" | "analytics" | "communication";
}

const INTEGRATIONS: Integration[] = [
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sync form submissions to Salesforce leads, contacts, and custom objects.",
    icon: "☁️",
    status: "disconnected",
    category: "crm",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Create contacts and deals in HubSpot from form submissions.",
    icon: "🧡",
    status: "disconnected",
    category: "crm",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Add new deals and contacts to your Pipedrive pipeline.",
    icon: "🔵",
    status: "disconnected",
    category: "crm",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect VeilForms to 5,000+ apps via Zapier workflows.",
    icon: "⚡",
    status: "disconnected",
    category: "automation",
  },
  {
    id: "webhook",
    name: "Custom Webhooks",
    description: "Send form data to any URL endpoint in real-time.",
    icon: "🔗",
    status: "disconnected",
    category: "automation",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get instant notifications in Slack when forms are submitted.",
    icon: "💬",
    status: "coming_soon",
    category: "communication",
  },
  {
    id: "google_analytics",
    name: "Google Analytics",
    description: "Track form views and submissions in Google Analytics.",
    icon: "📊",
    status: "coming_soon",
    category: "analytics",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Add form respondents to your Mailchimp email lists.",
    icon: "📧",
    status: "coming_soon",
    category: "communication",
  },
];

interface ConnectedIntegration {
  integrationId: string;
  connectedAt: string;
  accountName?: string;
}

export default function IntegrationsPage() {
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    fetchConnectedIntegrations();
  }, []);

  const fetchConnectedIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const data = await response.json();
        setConnectedIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integrationId: string) => {
    setConnecting(integrationId);
    try {
      const response = await fetch(`/api/integrations/${integrationId}/connect`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      console.error("Failed to initiate connection:", error);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Are you sure you want to disconnect this integration?")) return;

    setConnecting(integrationId);
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConnectedIntegrations((prev) =>
          prev.filter((i) => i.integrationId !== integrationId)
        );
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setConnecting(null);
    }
  };

  const getIntegrationStatus = (id: string): Integration["status"] => {
    const integration = INTEGRATIONS.find((i) => i.id === id);
    if (integration?.status === "coming_soon") return "coming_soon";
    const connected = connectedIntegrations.find((c) => c.integrationId === id);
    return connected ? "connected" : "disconnected";
  };

  const filteredIntegrations =
    activeCategory === "all"
      ? INTEGRATIONS
      : INTEGRATIONS.filter((i) => i.category === activeCategory);

  const categories = [
    { id: "all", name: "All" },
    { id: "crm", name: "CRM" },
    { id: "automation", name: "Automation" },
    { id: "communication", name: "Communication" },
    { id: "analytics", name: "Analytics" },
  ];

  return (
    <div className="integrations-page">
      <style jsx>{`
        .integrations-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .page-description {
          color: #6b7280;
          margin: 0;
        }

        .category-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .category-tab {
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 9999px;
          background: white;
          color: #6b7280;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .category-tab:hover {
          border-color: #4f46e5;
          color: #4f46e5;
        }

        .category-tab.active {
          background: #4f46e5;
          border-color: #4f46e5;
          color: white;
        }

        .integrations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .integration-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.2s;
        }

        .integration-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .integration-card.connected {
          border-color: #10b981;
        }

        .integration-card.coming-soon {
          opacity: 0.7;
        }

        .integration-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .integration-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          background: #f3f4f6;
          border-radius: 8px;
        }

        .integration-info {
          flex: 1;
        }

        .integration-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.25rem 0;
        }

        .integration-status {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          display: inline-block;
        }

        .integration-status.connected {
          background: #d1fae5;
          color: #059669;
        }

        .integration-status.disconnected {
          background: #f3f4f6;
          color: #6b7280;
        }

        .integration-status.coming-soon {
          background: #fef3c7;
          color: #d97706;
        }

        .integration-description {
          color: #6b7280;
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 0 0 1rem 0;
        }

        .integration-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          flex: 1;
        }

        .btn-primary {
          background: #4f46e5;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4338ca;
        }

        .btn-secondary {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f9fafb;
        }

        .btn-danger {
          background: white;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .btn-danger:hover:not(:disabled) {
          background: #fef2f2;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .connected-info {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #e5e7eb;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
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
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .integrations-page {
            padding: 1rem;
          }

          .integrations-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Integrations</h1>
        <p className="page-description">
          Connect VeilForms to your favorite tools and services
        </p>
      </div>

      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading integrations...</p>
        </div>
      ) : (
        <div className="integrations-grid">
          {filteredIntegrations.map((integration) => {
            const status = getIntegrationStatus(integration.id);
            const connectedData = connectedIntegrations.find(
              (c) => c.integrationId === integration.id
            );

            return (
              <div
                key={integration.id}
                className={`integration-card ${status === "connected" ? "connected" : ""} ${
                  status === "coming_soon" ? "coming-soon" : ""
                }`}
              >
                <div className="integration-header">
                  <div className="integration-icon">{integration.icon}</div>
                  <div className="integration-info">
                    <h3 className="integration-name">{integration.name}</h3>
                    <span className={`integration-status ${status}`}>
                      {status === "connected" && "Connected"}
                      {status === "disconnected" && "Not connected"}
                      {status === "coming_soon" && "Coming Soon"}
                    </span>
                  </div>
                </div>

                <p className="integration-description">{integration.description}</p>

                <div className="integration-actions">
                  {status === "connected" ? (
                    <>
                      <button className="btn btn-secondary">Configure</button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={connecting === integration.id}
                      >
                        {connecting === integration.id ? "..." : "Disconnect"}
                      </button>
                    </>
                  ) : status === "coming_soon" ? (
                    <button className="btn btn-secondary" disabled>
                      Coming Soon
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConnect(integration.id)}
                      disabled={connecting === integration.id}
                    >
                      {connecting === integration.id ? "Connecting..." : "Connect"}
                    </button>
                  )}
                </div>

                {connectedData && (
                  <div className="connected-info">
                    {connectedData.accountName && (
                      <div>Account: {connectedData.accountName}</div>
                    )}
                    <div>
                      Connected:{" "}
                      {new Date(connectedData.connectedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
