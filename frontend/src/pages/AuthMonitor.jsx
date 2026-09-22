import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge, { decisionTone } from "../components/Badge.jsx";
import { getAuthenticationLogs } from "../services/dataService.js";

export default function AuthMonitor() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAuthenticationLogs().then(setLogs);
  }, []);

  const metrics = useMemo(() => {
    let success = 0;
    let failed = 0;
    logs.forEach((l) => {
      if (l.authentication_status === "SUCCESS") success++;
      else failed++;
    });
    return {
      total: logs.length,
      success,
      failed,
      rate: logs.length > 0 ? Math.round((success / logs.length) * 100) : 0,
    };
  }, [logs]);

  // Auth by Device Bar Chart
  const authChartData = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      if (!map[l.device_id]) {
        map[l.device_id] = { device: l.device_id, success: 0, failed: 0 };
      }
      if (l.authentication_status === "SUCCESS") map[l.device_id].success++;
      else map[l.device_id].failed++;
    });
    return Object.values(map);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch =
        l.device_id.toLowerCase().includes(search.toLowerCase()) ||
        l.nonce.toLowerCase().includes(search.toLowerCase()) ||
        (l.authentication_method && l.authentication_method.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filter === "success") return l.authentication_status === "SUCCESS";
      if (filter === "failed") return l.authentication_status !== "SUCCESS";
      return true;
    });
  }, [logs, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Ed25519 Authentication Monitor</h1>
          <p className="page-subtitle">
            Cryptographic challenge-response verification log. Every nonce is single-use with timestamp checks for complete replay attack mitigation.
          </p>
        </div>
      </div>

      <div className="grid">
        <StatCard
          label="Total Auth Attempts"
          value={metrics.total}
          tone="brand"
          trend={<span>Cryptographically signed challenges</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          )}
        />
        <StatCard
          label="Valid Authentications"
          value={metrics.success}
          tone="allow"
          trend={<span>{metrics.rate}% verification success rate</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Failed / Rejected Attempts"
          value={metrics.failed}
          tone="deny"
          trend={<span>Invalid signature / Replay attempts</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
        />
      </div>

      <Panel title="Authentication Attempts per Device" badge="Auth Bar Chart">
        {authChartData.length === 0 ? (
          <EmptyState>No authentication attempts logged yet.</EmptyState>
        ) : (
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={authChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="device" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                <Bar dataKey="success" name="Valid (Success)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Invalid (Failed)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
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
            placeholder="Search by device ID or nonce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All ({logs.length})
          </button>
          <button className={`filter-pill ${filter === "success" ? "active" : ""}`} onClick={() => setFilter("success")}>
            Success ({metrics.success})
          </button>
          <button className={`filter-pill ${filter === "failed" ? "active" : ""}`} onClick={() => setFilter("failed")}>
            Failed ({metrics.failed})
          </button>
        </div>
      </div>

      <Panel title="Challenge-Response Audit Trail" badge={`${filteredLogs.length} Showing`}>
        {filteredLogs.length === 0 ? (
          <EmptyState>No authentication attempts match your search.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Challenge Nonce</th>
                  <th>Algorithm</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.device_id}</strong></td>
                    <td className="muted">{l.nonce.slice(0, 20)}...</td>
                    <td><span className="badge info">{l.authentication_method}</span></td>
                    <td><Badge tone={decisionTone(l.authentication_status)}>{l.authentication_status}</Badge></td>
                    <td className="muted">{new Date(l.timestamp).toLocaleString()}</td>
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
