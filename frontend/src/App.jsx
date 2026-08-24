import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Devices from "./pages/Devices.jsx";
import AuthMonitor from "./pages/AuthMonitor.jsx";
import DatasetAnalysis from "./pages/DatasetAnalysis.jsx";
import ModelEvaluation from "./pages/ModelEvaluation.jsx";
import RiskAnalysis from "./pages/RiskAnalysis.jsx";
import AccessControlPage from "./pages/AccessControlPage.jsx";
import SecurityEvents from "./pages/SecurityEvents.jsx";
import BlockchainAudit from "./pages/BlockchainAudit.jsx";

const STORAGE_KEYS = {
  users: "zti.frontend.users.v1",
  session: "zti.frontend.session.v1",
};

const ADMIN_ACCOUNT = {
  username: "admin",
  password: "admin1234",
  role: "admin",
  displayName: "Administrator",
};

const PAGES = {
  dashboard: Dashboard,
  devices: Devices,
  auth: AuthMonitor,
  dataset: DatasetAnalysis,
  models: ModelEvaluation,
  risk: RiskAnalysis,
  access: AccessControlPage,
  events: SecurityEvents,
  audit: BlockchainAudit,
};

function readStoredValue(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  if (typeof window === "undefined") return;
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function buildSession(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || "user",
  };
}

function AuthScreen({ users, onAuthenticate }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = onAuthenticate({ mode, ...form });
    if (!result.ok) {
      setMessage({ type: "error", text: result.message });
      return;
    }

    setMessage({
      type: "success",
      text: mode === "login" ? `Welcome back, ${result.session.displayName}.` : "Account created successfully.",
    });
    setForm({ username: "", password: "" });
  }

  const signedUpUsers = useMemo(() => users.filter((user) => user.username !== ADMIN_ACCOUNT.username), [users]);

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-intro">
          <div className="auth-intro-top">
            <div className="brand auth-brand">
              <span className="dot" />ZERO-TRUST IOT
              <small>Enterprise access portal</small>
            </div>
            <div className="auth-intro-badge">Secure entry</div>
          </div>

          <div className="auth-intro-copy">
            <p className="auth-kicker">Access management</p>
            <h1>Secure access for daily operations.</h1>
            <p>
              Sign in to reach the operational console, or create a local user account for a separate session.
              The interface keeps the focus on access, records, and system status.
            </p>
          </div>

          <div className="auth-metrics">
            <div className="auth-metric">
              <span>Accounts</span>
              <strong>{signedUpUsers.length + 1}</strong>
            </div>
            <div className="auth-metric">
              <span>Authentication</span>
              <strong>Protected</strong>
            </div>
            <div className="auth-metric">
              <span>Mode</span>
              <strong>{mode === "login" ? "Sign in" : "Sign up"}</strong>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
              Sign in
            </button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
              Sign up
            </button>
          </div>

          <div className="auth-card-body">
            <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
            <p>{mode === "login" ? "Enter your credentials to continue." : "Create a username and password to get started."}</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder={mode === "login" ? "admin or your username" : "choose a username"}
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={mode === "login" ? "enter your password" : "create a password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>

              {message && <div className={`auth-message ${message.type}`}>{message.text}</div>}

              <button className="auth-submit" type="submit">
                {mode === "login" ? "Sign in to dashboard" : "Create account"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState(() => readStoredValue(STORAGE_KEYS.users, []));
  const [session, setSession] = useState(() => readStoredValue(STORAGE_KEYS.session, null));
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.session, session);
  }, [session]);

  function authenticate({ mode, username, password }) {
    const cleanUsername = normalizeUsername(username);
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      return { ok: false, message: "Enter both a username and password." };
    }

    if (mode === "signup") {
      if (cleanUsername === ADMIN_ACCOUNT.username) {
        return { ok: false, message: "The admin username is reserved." };
      }

      const existingUser = users.find((user) => normalizeUsername(user.username) === cleanUsername);
      if (existingUser) {
        return { ok: false, message: "That username is already registered." };
      }

      const account = {
        username: username.trim(),
        password: cleanPassword,
        role: "user",
        displayName: username.trim(),
      };

      const nextUsers = [...users, account];
      setUsers(nextUsers);
      const nextSession = buildSession(account);
      setSession(nextSession);
      setActive("dashboard");
      return { ok: true, session: nextSession };
    }

    if (cleanUsername === ADMIN_ACCOUNT.username && cleanPassword === ADMIN_ACCOUNT.password) {
      const nextSession = buildSession(ADMIN_ACCOUNT);
      setSession(nextSession);
      setActive("dashboard");
      return { ok: true, session: nextSession };
    }

    const existingUser = users.find((user) => normalizeUsername(user.username) === cleanUsername);
    if (!existingUser || existingUser.password !== cleanPassword) {
      return { ok: false, message: "Invalid username or password." };
    }

    const nextSession = buildSession(existingUser);
    setSession(nextSession);
    setActive("dashboard");
    return { ok: true, session: nextSession };
  }

  function handleLogout() {
    setSession(null);
    setActive("dashboard");
  }

  const Page = PAGES[active];

  if (!session) {
    return <AuthScreen users={users} onAuthenticate={authenticate} />;
  }

  return (
    <div className="shell">
      <Sidebar active={active} onNavigate={setActive} currentUser={session} onLogout={handleLogout} />
      <main className="main">
        <Page />
      </main>
    </div>
  );
}
