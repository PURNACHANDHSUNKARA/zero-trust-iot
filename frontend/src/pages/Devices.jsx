import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { getDevices } from "../services/dataService.js";
import { revokeDeviceOnChain, activateDeviceOnChain, connectWallet, getDeviceIdentityAdmin } from "../services/blockchain.js";

const ROLE_COLORS = {
  SENSOR: "#38bdf8",
  CAMERA: "#a855f7",
  ACTUATOR: "#f59e0b",
};

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [walletAccount, setWalletAccount] = useState(null);
  const [contractAdmin, setContractAdmin] = useState(null);

  const refresh = () => getDevices().then(setDevices);
  
  useEffect(() => { 
    refresh(); 
    getDeviceIdentityAdmin().then(setContractAdmin).catch(() => {});

    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accs) => {
        if (accs && accs.length > 0) setWalletAccount(accs[0]);
      }).catch(() => {});

      const handleAccounts = (accs) => {
        setWalletAccount(accs && accs.length > 0 ? accs[0] : null);
      };
      window.ethereum.on("accountsChanged", handleAccounts);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccounts);
      };
    }
  }, []);

  async function handleAction(deviceId, action) {
    setBusyId(deviceId);
    setMessage(null);
    try {
      const conn = await connectWallet();
      if (conn?.address) setWalletAccount(conn.address);
      const result = action === "revoke"
        ? await revokeDeviceOnChain(deviceId)
        : await activateDeviceOnChain(deviceId);
      setMessage({
        type: "info",
        text: `Transaction successful! ${action === "revoke" ? "Revoked" : "Activated"} ${deviceId} (Tx: ${result.txHash.slice(0, 12)}...)`,
      });
      // update local state immediately
      setDevices((prev) =>
        prev.map((d) => (d.device_id === deviceId ? { ...d, status: action === "revoke" ? "REVOKED" : "ACTIVE" } : d))
      );
    } catch (err) {
      setMessage({ type: "alert", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const metrics = useMemo(() => {
    let active = 0;
    let revoked = 0;
    const roles = new Set();
    devices.forEach((d) => {
      if (d.status === "ACTIVE") active++;
      else revoked++;
      if (d.role) roles.add(d.role);
    });
    return { total: devices.length, active, revoked, rolesCount: roles.size };
  }, [devices]);

  // Role distribution data for bar chart
  const roleChartData = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      const r = d.role || "OTHER";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({ role, count }));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.device_id.toLowerCase().includes(search.toLowerCase()) ||
        (d.device_name && d.device_name.toLowerCase().includes(search.toLowerCase())) ||
        (d.device_type && d.device_type.toLowerCase().includes(search.toLowerCase())) ||
        (d.did && d.did.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filter === "active") return d.status === "ACTIVE";
      if (filter === "revoked") return d.status === "REVOKED";
      return true;
    });
  }, [devices, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Decentralized Device Registry</h1>
          <p className="page-subtitle">
            Cryptographic IoT identity registry with Ed25519 public keys, W3C DIDs, and instant smart-contract revocation via DeviceIdentity.sol.
          </p>
        </div>
      </div>

      {message && (
        <div className={`banner ${message.type}`}>
          <span>{message.text}</span>
          <button className="action" onClick={() => setMessage(null)} style={{ padding: "4px 8px", fontSize: 11 }}>
            Dismiss
          </button>
        </div>
      )}

      {/* MetaMask Account Status Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "10px 16px",
          marginBottom: "16px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          fontSize: "13px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🦊 <strong>MetaMask Account:</strong></span>
          {walletAccount ? (
            <code style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
              {walletAccount}
            </code>
          ) : (
            <span style={{ color: "#94a3b8" }}>Not connected (will prompt on action)</span>
          )}
        </div>

        {walletAccount && contractAdmin && (
          <div>
            {walletAccount.toLowerCase() === contractAdmin.toLowerCase() ? (
              <span style={{ color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
                Contract Admin Authorized
              </span>
            ) : (
              <span style={{ color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }}></span>
                Unauthorized (Switch to Admin: {contractAdmin.slice(0, 6)}...{contractAdmin.slice(-4)} in MetaMask)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid">
        <StatCard
          label="Provisioned Devices"
          value={metrics.total}
          tone="brand"
          trend={<span>{metrics.rolesCount} distinct operational roles</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
          )}
        />
        <StatCard
          label="Active & Authorized"
          value={metrics.active}
          tone="allow"
          trend={<span>Smart contract verified</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Revoked / Blocked"
          value={metrics.revoked}
          tone="deny"
          trend={<span>Revocation enforced on-chain</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
        />
      </div>

      <Panel title="Device Role Distribution" badge="Fleet Telemetry">
        {roleChartData.length === 0 ? (
          <EmptyState>No devices provisioned yet.</EmptyState>
        ) : (
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="role" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" name="Device Count" radius={[6, 6, 0, 0]}>
                  {roleChartData.map((entry, index) => (
                    <Cell key={`role-${index}`} fill={ROLE_COLORS[entry.role] || "#38bdf8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="controls-bar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by device ID, type, DID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All ({devices.length})
          </button>
          <button className={`filter-pill ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>
            Active ({metrics.active})
          </button>
          <button className={`filter-pill ${filter === "revoked" ? "active" : ""}`} onClick={() => setFilter("revoked")}>
            Revoked ({metrics.revoked})
          </button>
        </div>
      </div>

      <Panel title="Registered IoT Devices" badge={`${filteredDevices.length} Showing`}>
        {filteredDevices.length === 0 ? (
          <EmptyState>No devices registered yet. Run device_simulator.py, then export_snapshot.py.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Device Type</th>
                  <th>Decentralized ID (DID)</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Blockchain Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((d) => (
                  <tr key={d.device_id}>
                    <td><strong>{d.device_id}</strong></td>
                    <td style={{ color: "var(--text)" }}>{d.device_type}</td>
                    <td className="muted">{d.did}</td>
                    <td>
                      <span className="badge" style={{ color: ROLE_COLORS[d.role] || "var(--text)", borderColor: ROLE_COLORS[d.role] || "var(--border)" }}>
                        {d.role}
                      </span>
                    </td>
                    <td>
                      <Badge tone={d.status === "ACTIVE" ? "active" : "revoked"}>{d.status}</Badge>
                    </td>
                    <td>
                      <button
                        className={`action ${d.status === "ACTIVE" ? "btn-danger" : "btn-success"}`}
                        disabled={busyId === d.device_id}
                        onClick={() => handleAction(d.device_id, d.status === "ACTIVE" ? "revoke" : "activate")}
                      >
                        {busyId === d.device_id ? "Processing..." : d.status === "ACTIVE" ? "Revoke on Chain" : "Activate on Chain"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
