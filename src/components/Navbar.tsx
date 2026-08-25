"use client";

import { useState } from "react";

interface NavbarProps {
  connectionStatus: "connected" | "disconnected" | "connecting";
  activeTab: "dashboard" | "rateLive" | "analytics" | "settings" | "users";
  onTabChange: (tab: "dashboard" | "rateLive" | "analytics" | "settings" | "users") => void;
  appTheme: "dark" | "light";
  onToggleTheme: () => void;
  userRole: "admin" | "user" | null;
  userName: string | null;
  onSignOut: () => void;
}

const navItems = [
  {
    id: "dashboard" as const,
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "rateLive" as const,
    label: "Rate Live",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    id: "analytics" as const,
    label: "Analytics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    id: "settings" as const,
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "users" as const,
    label: "Users",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function Navbar({
  connectionStatus,
  activeTab,
  onTabChange,
  appTheme,
  onToggleTheme,
  userRole,
  userName,
  onSignOut,
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const statusLabels = {
    connected: "Live",
    disconnected: "Offline",
    connecting: "Connecting",
  };

  const isAdmin = userRole === "admin";

  const handleTabClick = (tab: "dashboard" | "rateLive" | "analytics" | "settings" | "users") => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  const initials = userName ? userName.slice(0, 2).toUpperCase() : "??";

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-brand-icon">⚡</div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontWeight: 850, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #2563eb, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: "1.15rem" }}>RSVPAI</span>
            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>under JPPL Group</span>
          </div>
        </div>

        {/* Hamburger Toggle Button (Mobile Only) */}
        <button
          className="navbar-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Backdrop overlay */}
        {isMobileMenuOpen && (
          <div
            className="navbar-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Navigation & Profile container */}
        <div className={`navbar-menu-container ${isMobileMenuOpen ? "open" : ""}`}>

          {/* ── Mobile drawer header (hidden on desktop) ── */}
          <div className="navbar-menu-header">
            <div className="navbar-menu-brand">
              <div className="navbar-menu-brand-icon">⚡</div>
              <div>
                <div className="navbar-menu-brand-name">RSVPAI</div>
                <div className="navbar-menu-brand-sub">under JPPL Group</div>
              </div>
            </div>
            <button className="navbar-menu-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Navigation links ── */}
          <div className="navbar-nav-section">
            <span className="navbar-section-label">Navigation</span>
            <ul className="navbar-nav">
              {navItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleTabClick(item.id)}
                    className={`navbar-link ${activeTab === item.id ? "active" : ""}`}
                  >
                    <span className="navbar-link-icon">{item.icon}</span>
                    <span className="navbar-link-label">{item.label}</span>
                    {activeTab === item.id && <span className="navbar-link-active-dot" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Admin section ── */}
          {isAdmin && (
            <div className="navbar-nav-section">
              <span className="navbar-section-label">Admin</span>
              <ul className="navbar-nav">
                {adminItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleTabClick(item.id)}
                      className={`navbar-link ${activeTab === item.id ? "active" : ""}`}
                    >
                      <span className="navbar-link-icon">{item.icon}</span>
                      <span className="navbar-link-label">{item.label}</span>
                      {activeTab === item.id && <span className="navbar-link-active-dot" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Footer actions ── */}
          <div className="navbar-actions">
            {/* User profile card */}
            {userName && (
              <div className="navbar-profile-card">
                <div className="navbar-profile-avatar">{initials}</div>
                <div className="navbar-profile-info">
                  <span className="navbar-profile-name">{userName}</span>
                  <span className={`navbar-profile-role ${userRole}`}>{userRole}</span>
                </div>
                <button onClick={onSignOut} className="navbar-profile-signout" title="Sign Out">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="navbar-footer-row">
              {/* Theme Toggle */}
              <button
                onClick={onToggleTheme}
                className="theme-toggle-btn"
                title={`Switch to ${appTheme === "dark" ? "Light" : "Dark"} Theme`}
                style={{
                  background: "var(--bg-glass)",
                  border: "1px solid var(--bg-glass-border)",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                  transition: "all var(--transition-fast)",
                }}
              >
                {appTheme === "dark" ? "☀️" : "🌙"}
              </button>

              {/* Connection Status */}
              <div className={`navbar-status ${connectionStatus}`}>
                <span className="status-dot" />
                {statusLabels[connectionStatus]}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
