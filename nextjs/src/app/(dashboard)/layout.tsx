/**
 * VeilForms - Dashboard Layout
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStore } from "@/store/dashboard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useDashboardStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Check onboarding status and redirect if not completed
  useEffect(() => {
    if (isAuthenticated && user && !user.onboardingCompleted) {
      // Only redirect from dashboard pages, not from onboarding
      if (!pathname.startsWith('/onboarding')) {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, user, pathname, router]);

  // Update user in dashboard store
  useEffect(() => {
    if (user) {
      useDashboardStore.getState().setUser({
        id: user.id,
        email: user.email,
        plan: user.subscription as "free" | "pro" | "enterprise",
      });
    }
  }, [user]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (path: string) => {
    if (path === "/dashboard" && pathname === "/dashboard") return true;
    if (path !== "/dashboard" && pathname.startsWith(path)) return true;
    return false;
  };

  if (isLoading) {
    return (
      <div className="dashboard-body">
        <div className="dashboard-app">
          <div className="dashboard-main">
            <div className="dashboard-content">
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="dashboard-body">
      <div className="dashboard-app">
        {/* Sidebar */}
        <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <Link href="/" className="sidebar-logo">
              <span className="logo-veil">Veil</span>
              <span className="logo-forms">Forms</span>
            </Link>
            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              &times;
            </button>
          </div>

          <nav className="sidebar-nav">
            <Link
              href="/dashboard"
              className={`nav-item ${isActive("/dashboard") && !pathname.includes("/settings") && !pathname.includes("/api-keys") && !pathname.includes("/audit-logs") && !pathname.includes("/integrations") && !pathname.includes("/team") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Forms
            </Link>
            <Link
              href="/dashboard/api-keys"
              className={`nav-item ${isActive("/dashboard/api-keys") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              API Keys
            </Link>
            <Link
              href="/dashboard/audit-logs"
              className={`nav-item ${isActive("/dashboard/audit-logs") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
              Audit Logs
            </Link>
            <Link
              href="/dashboard/integrations"
              className={`nav-item ${isActive("/dashboard/integrations") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              Integrations
            </Link>
            <Link
              href="/dashboard/team"
              className={`nav-item ${isActive("/dashboard/team") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Team
            </Link>
            <Link
              href="/dashboard/settings"
              className={`nav-item ${isActive("/dashboard/settings") ? "active" : ""}`}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </Link>
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              <span className="user-plan">{user?.subscription || "Free"}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="dashboard-main">
          {/* Top Bar */}
          <header className="dashboard-topbar">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            <h1 className="page-title">
              {pathname === "/dashboard" && "Forms"}
              {pathname === "/dashboard/settings" && "Settings"}
              {pathname === "/dashboard/api-keys" && "API Keys"}
              {pathname === "/dashboard/audit-logs" && "Audit Logs"}
              {pathname === "/dashboard/integrations" && "Integrations"}
              {pathname === "/dashboard/team" && "Team"}
              {pathname.startsWith("/dashboard/forms/") && "Form Details"}
            </h1>
            <div className="topbar-actions">
              {pathname === "/dashboard" && (
                <Link href="/dashboard/forms/new" className="btn btn-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>New Form</span>
                </Link>
              )}
            </div>
          </header>

          {/* Content Area */}
          <div className="dashboard-content">{children}</div>
        </div>

        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
