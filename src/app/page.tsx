"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import RatesTable from "@/components/RatesTable";
import ExportToolbar from "@/components/ExportToolbar";
import CommoditiesChart from "@/components/CommoditiesChart";
import { AppSettings, RatesData, DEFAULT_SETTINGS } from "@/types";

interface RateRow {
  values: string[];
  netChange: number | null;
}

function resequenceRates(data: RatesData): RatesData {
  const { columns, rows } = data;
  
  // 1. Group the data rows by category based on the first cell (Item Name)
  const categoryRows: Record<string, RateRow[]> = {
    oil: [],     // SOYOIL...
    seed: [],    // SOYSEED...
    meal: [],    // SOYMEAL...
    castor: [],  // CASTOR...
    forex: [],   // CR$ or USDINR$
    crude: [],   // CRUDEOIL...
    klc: [],     // KLC...
    misc: []     // Any other fallback
  };

  rows.forEach((row) => {
    // Skip original group headers (which typically have only 1 or 2 values filled)
    const filledCount = row.values.filter((v) => v.trim() !== "").length;
    const isHeader = filledCount <= 2 && row.netChange === null;
    if (isHeader) return;

    const itemName = row.values[0]?.toUpperCase().trim() || "";
    
    if (itemName.includes("SOYOIL")) {
      categoryRows.oil.push(row);
    } else if (itemName.includes("SOYSEED")) {
      categoryRows.seed.push(row);
    } else if (itemName.includes("SOYMEAL")) {
      categoryRows.meal.push(row);
    } else if (itemName.includes("CASTOR")) {
      categoryRows.castor.push(row);
    } else if (itemName === "CR$" || itemName === "USDINR$" || itemName.includes("CR$") || itemName.includes("USDINR")) {
      categoryRows.forex.push(row);
    } else if (itemName.includes("CRUDEOIL") || itemName.includes("CRUDE OIL")) {
      categoryRows.crude.push(row);
    } else if (itemName.includes("KLC")) {
      categoryRows.klc.push(row);
    } else {
      categoryRows.misc.push(row);
    }
  });

  // 2. Build the new rows in the exact sequenced order with the new header names from the screenshot
  const newRows: RateRow[] = [];

  const sequence = [
    { key: "oil", header: "OIL - CBOT EXCHANGE, USA(CHICAGO)" },
    { key: "seed", header: "SEED - CBOT EXCHANGE, USA(CHICAGO)" },
    { key: "meal", header: "MEAL - CBOT EXCHANGE, USA(CHICAGO)" },
    { key: "castor", header: "CASTUR - INDIA" },
    { key: "forex", header: "FOREX - INDIA, (USINDR)" },
    { key: "crude", header: "CRUDE OIL - INDIA" },
    { key: "klc", header: "KLC (Bursa Malaysia)" }
  ];

  sequence.forEach(({ key, header }) => {
    const list = categoryRows[key];
    if (list && list.length > 0) {
      // Add custom category header row
      const headerValues = [header, ...Array(columns.length - 1).fill("")];
      newRows.push({
        values: headerValues,
        netChange: null
      });

      // Add all data rows in this category
      newRows.push(...list);
    }
  });

  // Append any misc rows at the end
  if (categoryRows.misc.length > 0) {
    const headerValues = ["OTHERS", ...Array(columns.length - 1).fill("")];
    newRows.push({
      values: headerValues,
      netChange: null
    });
    newRows.push(...categoryRows.misc);
  }

  return {
    columns,
    rows: newRows,
    rowCount: newRows.length,
    timestamp: data.timestamp
  };
}

export default function DashboardPage() {
  // Tab View State: 'dashboard' | 'rateLive' | 'analytics' | 'settings' | 'users'
  const [activeTab, setActiveTab] = useState<"dashboard" | "rateLive" | "analytics" | "settings" | "users">("dashboard");
  
  // High-Density/Compact layout toggle (small font separate)
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(false);

  // App UI Color Theme State (Dark vs Light)
  const [appTheme, setAppTheme] = useState<"dark" | "light">("dark");

  // Fullscreen Grid State
  const [isFullscreenGrid, setIsFullscreenGrid] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showPassword, setShowPassword] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // User Management State
  const [users, setUsers] = useState<{ username: string; password?: string; role: "admin" | "user" }[]>([]);
  const [loggedInUser, setLoggedInUser] = useState<{ username: string; role: "admin" | "user" } | null>(null);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Create User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [userFormError, setUserFormError] = useState("");

  // Rates Polling State
  const [ratesData, setRatesData] = useState<RatesData | null>(null);
  const [previousRows, setPreviousRows] = useState<RatesData["rows"]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [fetchCount, setFetchCount] = useState<number>(0);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // showToast Helper
  const showToast = useCallback((
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
  }, []);

  // Clear toast after timeout
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load settings, users & compact layout state from localStorage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem("liverates_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
      
      const savedCompact = localStorage.getItem("liverates_compact");
      if (savedCompact) {
        setIsCompactLayout(JSON.parse(savedCompact));
      }

      const savedTheme = localStorage.getItem("liverates_app_theme") as "dark" | "light";
      if (savedTheme === "light" || savedTheme === "dark") {
        setAppTheme(savedTheme);
      }

      // Initialize default users if database is empty
      const savedUsers = localStorage.getItem("liverates_users");
      let currentUsersList = [];
      if (!savedUsers) {
        const initialUsers = [
          { username: "admin", password: "admin123", role: "admin" as const },
          { username: "user", password: "user123", role: "user" as const }
        ];
        localStorage.setItem("liverates_users", JSON.stringify(initialUsers));
        currentUsersList = initialUsers;
      } else {
        currentUsersList = JSON.parse(savedUsers);
      }
      setUsers(currentUsersList);

      // Restore session state
      const savedSession = localStorage.getItem("liverates_logged_in_user");
      if (savedSession) {
        setLoggedInUser(JSON.parse(savedSession));
      }
    } catch {
      // Ignore parse errors — use defaults
    }
  }, []);

  // Update HTML data-theme attribute whenever appTheme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
    localStorage.setItem("liverates_app_theme", appTheme);
  }, [appTheme]);

  // Fullscreen change listener to sync state when ESC is pressed
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreenGrid(isFS);
      if (isFS) {
        document.body.classList.add("fullscreen-mode-enabled");
        setIsCompactLayout(true);
      } else {
        document.body.classList.remove("fullscreen-mode-enabled");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Enter Fullscreen Grid Mode
  const enterFullscreenGrid = () => {
    setIsFullscreenGrid(true);
    setIsCompactLayout(true);
    document.body.classList.add("fullscreen-mode-enabled");

    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {
        // Fallback if browser blocks request
        showToast("Fullscreen request blocked by browser.", "error");
      });
    }
  };

  // Exit Fullscreen Grid Mode
  const exitFullscreenGrid = () => {
    setIsFullscreenGrid(false);
    document.body.classList.remove("fullscreen-mode-enabled");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fetch rates from our API proxy
  const fetchRates = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (!settings.baseUrl || !settings.username || !settings.password) {
      setConnectionStatus("disconnected");
      setError("Please configure API settings first. Go to Settings tab.");
      return;
    }

    isFetchingRef.current = true;
    setConnectionStatus("connecting");

    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: settings.baseUrl,
          username: settings.username,
          password: settings.password,
          theme: settings.theme,
          dataPagePath: settings.dataPagePath,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const resequencedData = resequenceRates(json.data);

        // Keep previous rows for diff animation
        if (ratesData) {
          setPreviousRows(ratesData.rows);
        }

        setRatesData(resequencedData);
        setLastUpdated(
          new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        );
        setConnectionStatus("connected");
        setError("");
        setCountdown(settings.refreshInterval);
        setFetchCount((c) => c + 1);
      } else {
        setConnectionStatus("disconnected");
        setError(json.error || "Failed to fetch rates.");
      }
    } catch (err: unknown) {
      setConnectionStatus("disconnected");
      setError(
        err instanceof Error
          ? err.message
          : "Network error. Check your connection."
      );
    } finally {
      isFetchingRef.current = false;
    }
  }, [settings, ratesData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!isAutoRefresh || !settings.baseUrl) return;

    // Initial fetch
    fetchRates();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchRates();
    }, settings.refreshInterval * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings.baseUrl, settings.username, settings.password, settings.refreshInterval, isAutoRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer
  useEffect(() => {
    if (!isAutoRefresh || connectionStatus !== "connected") return;

    setCountdown(settings.refreshInterval);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) =>
        prev > 0 ? prev - 1 : settings.refreshInterval
      );
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAutoRefresh, connectionStatus, settings.refreshInterval, lastUpdated]);

  // Settings inputs handlers
  const handleSettingsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: name === "refreshInterval" ? value : value,
    }));
    setSettingsSaved(false);
    setTestResult(null);
  };

  const handleSettingsSave = () => {
    const sanitizedInterval = Math.max(1, parseInt(String(settings.refreshInterval)) || 1);
    const sanitizedSettings = {
      ...settings,
      refreshInterval: sanitizedInterval,
    };
    setSettings(sanitizedSettings);
    localStorage.setItem("liverates_settings", JSON.stringify(sanitizedSettings));
    setSettingsSaved(true);
    showToast("Settings saved successfully!", "success");
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleSettingsReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("liverates_settings");
    setSettingsSaved(false);
    setTestResult(null);
    showToast("Settings reset to defaults.", "info");
  };

  const handleTestConnection = async () => {
    if (!settings.baseUrl || !settings.username || !settings.password) {
      setTestResult({
        status: "error",
        message: "Please fill in Base URL, Username, and Password.",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    showToast("Testing connection...", "info");

    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: settings.baseUrl,
          username: settings.username,
          password: settings.password,
          theme: settings.theme,
          dataPagePath: settings.dataPagePath,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setTestResult({
          status: "success",
          message: `✅ Connection successful! Received ${json.data.rowCount} rows of rate data.`,
        });
        showToast("Connection test succeeded!", "success");
      } else {
        setTestResult({
          status: "error",
          message: `❌ ${json.error || "Connection failed."}`,
        });
        showToast("Connection test failed.", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error.";
      setTestResult({
        status: "error",
        message: `❌ ${msg}`,
      });
      showToast("Connection test failed.", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const found = users.find(
      (u) => u.username === loginUsername.trim() && u.password === loginPassword
    );

    if (found) {
      const userSession = { username: found.username, role: found.role };
      localStorage.setItem("liverates_logged_in_user", JSON.stringify(userSession));
      setLoggedInUser(userSession);
      showToast(`Welcome back, ${found.username}!`, "success");
      setLoginUsername("");
      setLoginPassword("");
    } else {
      setLoginError("Invalid username or password. Check credentials below.");
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("liverates_logged_in_user");
    setLoggedInUser(null);
    setActiveTab("dashboard");
    showToast("Signed out successfully.", "info");
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError("");

    const name = newUsername.trim();
    const pass = newPassword;

    if (!name || !pass) {
      setUserFormError("Username and password are required.");
      return;
    }

    if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
      setUserFormError("Username already exists.");
      return;
    }

    const updatedUsers = [...users, { username: name, password: pass, role: newRole }];
    localStorage.setItem("liverates_users", JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    showToast(`User ${name} created successfully!`, "success");
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
  };

  const handleDeleteUser = (usernameToDelete: string) => {
    if (usernameToDelete === loggedInUser?.username) {
      showToast("You cannot delete yourself!", "error");
      return;
    }

    const updatedUsers = users.filter((u) => u.username !== usernameToDelete);
    localStorage.setItem("liverates_users", JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    showToast(`User ${usernameToDelete} deleted.`, "info");
  };
  
  // Toggle Compact layout and save
  const toggleCompactLayout = (checked: boolean) => {
    setIsCompactLayout(checked);
    localStorage.setItem("liverates_compact", JSON.stringify(checked));
    showToast(
      checked ? "Switched to Compact View (Small Font)" : "Switched to Standard View",
      "info"
    );
  };

  // Compute stats — exclude group header rows
  const dataRows =
    ratesData?.rows.filter((r) => {
      const filled = r.values.filter((v) => v.trim() !== "").length;
      return filled > 2 || r.netChange !== null;
    }) || [];

  const totalCommodities = dataRows.length;
  const positiveCount = dataRows.filter(
    (r) => r.netChange !== null && r.netChange > 0
  ).length;
  const negativeCount = dataRows.filter(
    (r) => r.netChange !== null && r.netChange < 0
  ).length;
  const unchangedCount = totalCommodities - positiveCount - negativeCount;

  if (!loggedInUser) {
    return (
      <div className="login-viewport">
        <div className="login-card glass-card fade-in">
          <div className="login-header">
            <span style={{ fontSize: "2.2rem" }}>🛢️</span>
            <h2>Live Rates Terminal</h2>
            <p>Enter your credentials to access the rates panel</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="login-form">
            {loginError && <div className="login-error-alert">⚠️ {loginError}</div>}
            
            <div className="form-group">
              <label className="form-label" htmlFor="loginUsername">Username</label>
              <input
                type="text"
                id="loginUsername"
                className="form-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="loginPassword">Password</label>
              <input
                type="password"
                id="loginPassword"
                className="form-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>
              Sign In
            </button>
          </form>

          <div className="login-tips">
            <strong>💡 Quick Login Credentials:</strong>
            <ul>
              <li><strong>Admin Role:</strong> admin / admin123</li>
              <li><strong>User Role:</strong> user / user123</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar
        connectionStatus={connectionStatus}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setTestResult(null); // Clear test connection output when leaving settings
        }}
        appTheme={appTheme}
        onToggleTheme={() => setAppTheme(prev => prev === "dark" ? "light" : "dark")}
        userRole={loggedInUser.role}
        userName={loggedInUser.username}
        onSignOut={handleSignOut}
      />

      {/* Print-only header */}
      <div className="print-header">
        <h1>Live Oil Rates Report</h1>
        <p>Last Updated: {lastUpdated || "—"}</p>
      </div>

      <div className="page-container fade-in">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {activeTab === "dashboard" && "Market Dashboard Overview"}
              {activeTab === "rateLive" && "Live Rates Feed"}
              {activeTab === "analytics" && "Market Analytics Charts"}
              {activeTab === "settings" && "API Connection Settings"}
              {activeTab === "users" && "User Accounts & Management"}
            </h1>
            <p className="page-subtitle">
              {activeTab === "dashboard" && "Summary stats cards and commodities metrics chart"}
              {activeTab === "rateLive" && `Real-time rates comparison · Auto-refresh every ${settings.refreshInterval}s`}
              {activeTab === "analytics" && "Real-time commodities visual chart metrics"}
              {activeTab === "settings" && "Configure credentials and parameters of your ASP.NET rate feed"}
              {activeTab === "users" && "Create, review, and delete accounts and permissions in the system"}
            </p>
          </div>

          {/* Quick Toolbar (Always visible except in Settings/Users) */}
          {activeTab !== "settings" && activeTab !== "users" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {activeTab === "rateLive" && <ExportToolbar data={ratesData} showToast={showToast} />}

              <button
                className={`btn ${isAutoRefresh ? "btn-danger" : "btn-primary"}`}
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                id="btn-toggle-refresh"
              >
                {isAutoRefresh ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Start
                  </>
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => fetchRates()}
                disabled={connectionStatus === "connecting"}
                id="btn-manual-refresh"
                title="Refresh now"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation:
                      connectionStatus === "connecting"
                        ? "spin 0.8s linear infinite"
                        : "none",
                  }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Refresh Info Bar (Dashboard & Rate Live & Analytics) */}
        {activeTab !== "settings" && activeTab !== "users" && lastUpdated && (
          <div className="refresh-info" style={{ marginBottom: "16px" }}>
            <span className="last-updated">Last Updated: {lastUpdated}</span>
            {isAutoRefresh && (
              <span className="refresh-countdown">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {connectionStatus === "connecting" ? "Refreshing..." : `Next in ${countdown}s`}
              </span>
            )}
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              · {fetchCount} refreshes
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && activeTab !== "settings" && (
          <div
            className="glass-card"
            style={{
              marginBottom: "16px",
              background: "var(--rate-negative-bg)",
              borderColor: "var(--rate-negative-border)",
              color: "var(--rate-negative)",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 1: DASHBOARD (OVERVIEW OF CARDS & CHARTS)
            ──────────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats Row */}
            {ratesData && ratesData.rows.length > 0 && (
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label">Total Commodities</div>
                  <div className="stat-value">{totalCommodities}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Gaining ▲</div>
                  <div className="stat-value positive">{positiveCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Declining ▼</div>
                  <div className="stat-value negative">{negativeCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Unchanged</div>
                  <div className="stat-value" style={{ color: "var(--text-muted)" }}>
                    {unchangedCount}
                  </div>
                </div>
              </div>
            )}

            {/* Commodities Chart rendered directly in dashboard tab */}
            {ratesData ? (
              <CommoditiesChart
                columns={ratesData?.columns || []}
                rows={ratesData?.rows || []}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📈</div>
                <div className="empty-title">Waiting for Rate Data...</div>
                <div className="empty-desc">
                  Rates data will load automatically when connection is established.
                </div>
              </div>
            )}
          </>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 2: RATE LIVE (THE MAIN FULL TABLE)
            ──────────────────────────────────────────────────────── */}
        {activeTab === "rateLive" && (
          <>
            {/* Dashboard Control Bar */}
            {ratesData && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                {/* Fullscreen Button */}
                <button
                  className="btn btn-primary"
                  onClick={enterFullscreenGrid}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  Fullscreen Mode
                </button>

                <div className="layout-toggle-container">
                  <span className="layout-toggle-label">Compact Layout (Small Font)</span>
                  <input
                    type="checkbox"
                    id="compact-toggle"
                    checked={isCompactLayout}
                    onChange={(e) => toggleCompactLayout(e.target.checked)}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "var(--accent-blue)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Rates Table Content */}
            {connectionStatus === "connecting" && !ratesData ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <div className="loading-text">
                  Connecting to rate server and fetching data...
                </div>
              </div>
            ) : !settings.baseUrl ? (
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <div className="empty-title">Configure API Settings</div>
                <div className="empty-desc">
                  Go to <button onClick={() => setActiveTab("settings")} style={{ background: "none", border: "none", color: "var(--accent-blue)", textDecoration: "underline", cursor: "pointer", padding: 0 }}>Settings Tab</button> to enter your API credentials to start viewing live rates.
                </div>
              </div>
            ) : (
              <div className={isCompactLayout ? "compact-table" : ""}>
                <RatesTable
                  columns={ratesData?.columns || []}
                  rows={ratesData?.rows || []}
                  previousRows={previousRows}
                />
              </div>
            )}
          </>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 3: MARKET ANALYTICS CHART (FULL VIEW)
            ──────────────────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <CommoditiesChart
            columns={ratesData?.columns || []}
            rows={ratesData?.rows || []}
          />
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 4: SETTINGS
            ──────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="glass-card fade-in">
            <div className="settings-grid">
              {/* Section: Connection */}
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--border-subtle)",
                  paddingBottom: "8px",
                }}
              >
                🔗 Connection Parameters
              </h2>

              <div className="form-group">
                <label className="form-label" htmlFor="baseUrl">
                  API Base URL
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="baseUrl"
                  name="baseUrl"
                  value={settings.baseUrl}
                  onChange={handleSettingsChange}
                  placeholder="https://example.com/RatePortal/"
                />
                <span className="form-hint">
                  The base URL of the rate server (include trailing slash)
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="username">
                    Username
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    id="username"
                    name="username"
                    value={settings.username}
                    onChange={handleSettingsChange}
                    placeholder="your_username"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Password
                  </label>
                  <div className="form-input-password-wrapper">
                    <input
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={settings.password}
                      onChange={handleSettingsChange}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section: Display */}
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--border-subtle)",
                  paddingBottom: "8px",
                  marginTop: "12px",
                }}
              >
                🎨 Display & Refresh Config
              </h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="theme">
                    Portal Theme
                  </label>
                  <select
                    className="form-select"
                    id="theme"
                    name="theme"
                    value={settings.theme}
                    onChange={handleSettingsChange}
                  >
                    <option value="WhiteGreen">White Green</option>
                    <option value="BlackGold">Black Gold</option>
                    <option value="DarkBlue">Dark Blue</option>
                    <option value="Classic">Classic</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="appUITheme">
                    App Theme Mode
                  </label>
                  <select
                    className="form-select"
                    id="appUITheme"
                    value={appTheme}
                    onChange={(e) => setAppTheme(e.target.value as "dark" | "light")}
                  >
                    <option value="dark">Dark Theme (Glassmorphic)</option>
                    <option value="light">Light Theme (Premium White)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="refreshInterval">
                    Refresh Interval (seconds)
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    id="refreshInterval"
                    name="refreshInterval"
                    value={settings.refreshInterval}
                    onChange={handleSettingsChange}
                    min={1}
                    max={120}
                  />
                  <span className="form-hint">Minimum 1 second</span>
                </div>
              </div>

              {/* Section: Advanced */}
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--border-subtle)",
                  paddingBottom: "8px",
                  marginTop: "12px",
                }}
              >
                ⚙️ Advanced
              </h2>

              <div className="form-group">
                <label className="form-label" htmlFor="dataPagePath">
                  Data Page Path
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="dataPagePath"
                  name="dataPagePath"
                  value={settings.dataPagePath}
                  onChange={handleSettingsChange}
                  placeholder="ViewInfoMobile.aspx"
                />
                <span className="form-hint">
                  The ASP.NET page that returns rate data (default: ViewInfoMobile.aspx)
                </span>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={handleSettingsSave}
                  id="btn-save-settings"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Settings
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleTestConnection}
                  disabled={testing}
                  id="btn-test-connection"
                >
                  {testing ? (
                    <>
                      <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Testing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Test Connection
                    </>
                  )}
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleSettingsReset}
                  id="btn-reset-settings"
                >
                  Reset to Defaults
                </button>

                {settingsSaved && (
                  <span className="settings-saved">✓ Settings saved!</span>
                )}
              </div>

              {/* Connection Test Output */}
              {testResult && (
                <div className={`test-result ${testResult.status}`}>
                  {testResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 5: USER MANAGEMENT MODULE (ADMIN ONLY)
            ──────────────────────────────────────────────────────── */}
        {activeTab === "users" && loggedInUser?.role === "admin" && (
          <div className="glass-card fade-in">
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                borderBottom: "1px solid var(--border-subtle)",
                paddingBottom: "12px",
                marginBottom: "20px",
              }}
            >
              👥 User Management
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "28px" }}>
              {/* Form to Add User */}
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>
                  Create New User Account
                </h3>
                <form onSubmit={handleCreateUser} className="settings-grid" style={{ gap: "16px" }}>
                  {userFormError && <div className="login-error-alert">⚠️ {userFormError}</div>}
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="newUsername">Username</label>
                    <input
                      type="text"
                      id="newUsername"
                      className="form-input"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      placeholder="e.g. trader1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="newPassword">Password</label>
                    <input
                      type="password"
                      id="newPassword"
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter user password"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="newRole">Role / Permissions</label>
                    <select
                      id="newRole"
                      className="form-select"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
                    >
                      <option value="user">User (View Only)</option>
                      <option value="admin">Admin (Full Control)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "10px 24px" }}>
                    Create User
                  </button>
                </form>
              </div>

              {/* Users List Display */}
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>
                  Current Active Users
                </h3>
                
                <div className="rates-table-wrapper" style={{ maxHeight: "350px", overflowY: "auto" }}>
                  <table className="rates-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.username} className="row-neutral">
                          <td style={{ fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}>{u.username}</td>
                          <td>
                            <span className={`navbar-profile-role ${u.role}`} style={{ display: "inline-block" }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              disabled={u.username === loggedInUser?.username}
                              className="btn btn-danger btn-icon"
                              title="Delete user"
                              style={{
                                width: "28px",
                                height: "28px",
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: u.username === loggedInUser?.username ? 0.3 : 1
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Overlay Render */}
      {isFullscreenGrid && (
        <div className="fullscreen-grid-active fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                🖥️ Live Rates Fullscreen Monitor (Compact Mode)
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Last Polled: {lastUpdated || "—"} · Polling every {settings.refreshInterval}s
              </p>
            </div>
            <button
              className="btn btn-danger"
              onClick={exitFullscreenGrid}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4" />
              </svg>
              Exit Fullscreen
            </button>
          </div>
          <div className="compact-table">
            <RatesTable
              columns={ratesData?.columns || []}
              rows={ratesData?.rows || []}
              previousRows={previousRows}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}
