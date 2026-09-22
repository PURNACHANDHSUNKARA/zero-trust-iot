import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import TopHeader from "./components/TopHeader.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Devices from "./pages/Devices.jsx";
import AuthMonitor from "./pages/AuthMonitor.jsx";
import DatasetAnalysis from "./pages/DatasetAnalysis.jsx";
import ModelEvaluation from "./pages/ModelEvaluation.jsx";
import RiskAnalysis from "./pages/RiskAnalysis.jsx";
import AccessControlPage from "./pages/AccessControlPage.jsx";
import SecurityEvents from "./pages/SecurityEvents.jsx";
import BlockchainAudit from "./pages/BlockchainAudit.jsx";
import { 
  authenticateWithMetaMask, 
  requestAccessWallet, 
  ADMIN_ADDRESS 
} from "./services/blockchain.js";

const STORAGE_KEYS = {
  session: "zti.metamask.session.v5",
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

const PAGE_META = {
  dashboard: {
    title: "Security Operations Center Overview",
    desc: "Real-time Zero-Trust IoT telemetry, access decisions, and threat indicators.",
  },
  devices: {
    title: "Device Management",
    desc: "IoT Device Registry and Ethereum smart contract provisioning.",
  },
  auth: {
    title: "Authentication Monitor",
    desc: "Ed25519 signature verification logs and replay attack prevention.",
  },
  dataset: {
    title: "Dataset Analysis",
    desc: "IoT cybersecurity feature telemetry and behavioral statistics.",
  },
  models: {
    title: "ML Model Performance",
    desc: "Comparative Intrusion Detection accuracy evaluation across 8 algorithms.",
  },
  risk: {
    title: "Behavioral Risk Analysis",
    desc: "Continuous dynamic risk scoring and anomaly detection matrix.",
  },
  access: {
    title: "Access Control",
    desc: "Role-Based Access Control policy matrix and Super Admin request manager.",
  },
  events: {
    title: "Security Events",
    desc: "Real-time incident response and security violation alerts.",
  },
  audit: {
    title: "Blockchain Audit",
    desc: "Immutable on-chain security activity queried directly from AuditLog.sol.",
  },
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

function MetaMaskAuthScreen({ onAuthenticateSuccess, theme, onToggleTheme }) {
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [step, setStep] = useState(0); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [accessState, setAccessState] = useState(null); 
  const [connectedWallet, setConnectedWallet] = useState(null);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accs) => {
          if (accs && accs.length > 0) setConnectedWallet(accs[0]);
        })
        .catch(() => {});
    }
  }, []);

  async function handleConnectMetaMask() {
    setLoading(true);
    setErrorMsg(null);
    setAccessState(null);
    setStep(1);

    try {
      setTimeout(() => setStep(2), 400);

      const result = await authenticateWithMetaMask();
      setStep(3);

      if (result.ok) {
        const session = {
          address: result.address,
          role: result.role,
          roleLabel: result.roleLabel,
          isSuperAdmin: result.status === "SUPER_ADMIN",
          displayName: result.status === "SUPER_ADMIN" ? "Super Admin" : "Authorized User",
          signature: result.signature,
          nonce: result.nonce,
          network: result.network,
          authenticatedAt: new Date().toLocaleTimeString(),
        };
        onAuthenticateSuccess(session);
      } else {
        setConnectedWallet(result.address);
        setAccessState(result.status);
      }
    } catch (err) {
      console.error("MetaMask auth error:", err);
      setErrorMsg(err.message || "Failed to authenticate with MetaMask.");
    } finally {
      setLoading(false);
      setStep(0);
    }
  }

  async function handleRequestAccess() {
    if (!connectedWallet) return;
    setRequesting(true);
    try {
      await requestAccessWallet(connectedWallet);
      setAccessState("PENDING");
    } catch (e) {
      setErrorMsg(e.message || "Failed to submit access request.");
    } finally {
      setRequesting(false);
    }
  }

  function handleSimulateAdmin() {
    const mockSession = {
      address: ADMIN_ADDRESS,
      role: "super_admin",
      roleLabel: "Super Admin (Contract Owner)",
      isSuperAdmin: true,
      displayName: "Super Admin",
      signature: "0x_simulated_proof_signature_admin",
      nonce: "zti-simulated-nonce",
      network: "Ganache Local (1337)",
      authenticatedAt: new Date().toLocaleTimeString(),
    };
    onAuthenticateSuccess(mockSession);
  }

  return (
    <div className="light-portal-root">
      {/* Light Enterprise Top Navbar */}
      <header className="light-portal-navbar">
        <div className="portal-brand-box">
          <div className="brand-shield-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="portal-title">ZERO-TRUST IoT</div>
            <div className="portal-sub">Security Framework</div>
          </div>
        </div>

        <div className="portal-status-pills">
          {/* Light / Dark Theme Switcher Button */}
          <button 
            className="theme-toggle-btn" 
            type="button" 
            onClick={onToggleTheme}
            title="Toggle Light or Dark Theme"
          >
            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>

          <div className="portal-pill">
            <span className="pill-dot-green" />
            <span>NETWORK: <strong>Ganache Local</strong></span>
          </div>
          <div className="portal-pill">
            <span className="pill-dot-blue" />
            <span>CONTRACT: <strong>AccessControl.sol</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="light-portal-container">
        <div className="light-portal-grid">
          {/* Left Column: Platform Security Overview */}
          <section className="portal-hero-section">
            <div className="portal-badge-kicker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>DECENTRALIZED IDENTITY & TRUST MANAGEMENT</span>
            </div>

            <h1 className="portal-main-heading">
              Enterprise Zero-Trust Security & Smart Contract Authorization Platform
            </h1>

            <p className="portal-main-description">
              Cryptographically validated access control using Ed25519 signatures, W3C DIDs, and Ethereum smart contract policy enforcement for IoT ecosystems.
            </p>

            {/* Metrics Row */}
            <div className="portal-stats-row">
              <div className="pstat-card">
                <div className="pstat-val">3,000</div>
                <div className="pstat-lbl">Provisioned IoT Devices</div>
              </div>
              <div className="pstat-card">
                <div className="pstat-val">99.8%</div>
                <div className="pstat-lbl">Policy Clearance Rate</div>
              </div>
              <div className="pstat-card">
                <div className="pstat-val">EIP-191</div>
                <div className="pstat-lbl">Cryptographic Signatures</div>
              </div>
              <div className="pstat-card">
                <div className="pstat-val">Solidity</div>
                <div className="pstat-lbl">On-Chain Policy Engine</div>
              </div>
            </div>
          </section>

          {/* Right Column: Web3 Authentication Card */}
          <section className="portal-auth-section">
            {accessState === "PENDING" ? (
              <div className="auth-card-panel state-pending">
                <div className="card-header-row">
                  <div className="header-icon-box warn">⏳</div>
                  <div>
                    <h2 className="card-title">Access Request Pending</h2>
                    <p className="card-sub">Your request is waiting for Super Admin approval.</p>
                  </div>
                </div>

                <div className="card-detail-box">
                  <div className="detail-row">
                    <span>Connected Wallet:</span>
                    <code className="warn">{connectedWallet}</code>
                  </div>
                  <div className="detail-row" style={{ marginTop: 8 }}>
                    <span>Authorization Status:</span>
                    <span className="badge-status warn">PENDING APPROVAL</span>
                  </div>
                </div>

                <div className="card-actions-column">
                  <button className="btn-primary-blue" onClick={handleConnectMetaMask} disabled={loading}>
                    <span>🔄 Refresh / Re-check Status</span>
                  </button>
                  <button className="btn-secondary-white" onClick={() => setAccessState(null)}>
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            ) : accessState === "UNAUTHORIZED" || accessState === "REJECTED" ? (
              <div className="auth-card-panel state-denied">
                <div className="card-header-row">
                  <div className="header-icon-box danger">⛔</div>
                  <div>
                    <h2 className="card-title">Access Required</h2>
                    <p className="card-sub">
                      {accessState === "REJECTED"
                        ? "Your wallet access request was rejected by the Super Admin."
                        : "Your wallet is not authorized on AccessControl.sol."}
                    </p>
                  </div>
                </div>

                <div className="card-detail-box">
                  <div className="detail-row">
                    <span>Connected Wallet:</span>
                    <code className="danger">{connectedWallet}</code>
                  </div>
                  <div className="detail-divider">SUPER ADMIN REQUIRED</div>
                  <div className="detail-row">
                    <span>Contract Owner:</span>
                    <code className="admin">{`${ADMIN_ADDRESS.slice(0, 6)}...${ADMIN_ADDRESS.slice(-4)}`}</code>
                  </div>

                </div>

                <div className="card-actions-column">
                  <button className="btn-primary-blue" onClick={handleRequestAccess} disabled={requesting}>
                    <span>🚀 {requesting ? "Submitting Request..." : "Request Access from Admin"}</span>
                  </button>
                  <button className="btn-secondary-white" onClick={handleConnectMetaMask} disabled={loading}>
                    <span>🦊 Switch Account in MetaMask</span>
                  </button>
                  <button className="btn-secondary-white" onClick={() => setAccessState(null)}>
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-card-panel">
                <div className="card-header-row">
                  <div>
                    <h2 className="card-title">Web3 Identity Authentication</h2>
                    <p className="card-sub">Connect MetaMask wallet to prove cryptographic key ownership.</p>
                  </div>
                </div>

                {loading && (
                  <div className="auth-step-progress">
                    <div className={`step-item ${step >= 1 ? "active" : ""}`}>
                      <span className="num">1</span> Account Request
                    </div>
                    <div className={`step-item ${step >= 2 ? "active" : ""}`}>
                      <span className="num">2</span> EIP-191 Nonce Challenge
                    </div>
                    <div className={`step-item ${step >= 3 ? "active" : ""}`}>
                      <span className="num">3</span> Authorization Verification
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="auth-error-alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="auth-action-stack">
                  <button 
                    className="btn-metamask-primary" 
                    onClick={handleConnectMetaMask}
                    disabled={loading}
                  >
                    <span className="fox-emoji">🦊</span>
                    <div className="btn-text">
                      <span className="title">{loading ? "Authenticating..." : "Connect MetaMask"}</span>
                      <span className="sub">Cryptographic EIP-191 Signature Verification</span>
                    </div>
                  </button>                </div>


                <div className="card-footer-info">
                  <span>Network: <strong>Ganache Local (1337)</strong></span>
                  <span>Contract: <strong>AccessControl.sol</strong></span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => readStoredValue(STORAGE_KEYS.session, null));
  const [active, setActive] = useState("dashboard");
  const [theme, setTheme] = useState(() => readStoredValue("zti.theme.v1", "light"));

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.session, session);
  }, [session]);

  useEffect(() => {
    writeStoredValue("zti.theme.v1", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function handleLogout() {
    setSession(null);
    setActive("dashboard");
  }

  function handleToggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  const Page = PAGES[active];
  const meta = PAGE_META[active] || { title: "Zero-Trust Security Console", desc: "" };

  if (!session) {
    return <MetaMaskAuthScreen onAuthenticateSuccess={setSession} theme={theme} onToggleTheme={handleToggleTheme} />;
  }

  return (
    <div className="shell">
      <Sidebar active={active} onNavigate={setActive} currentUser={session} onLogout={handleLogout} />
      <div className="main-content-wrapper">
        <TopHeader 
          pageTitle={meta.title} 
          pageDescription={meta.desc} 
          currentUser={session} 
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
        <main className="main">
          <Page />
        </main>
      </div>
    </div>
  );
}





