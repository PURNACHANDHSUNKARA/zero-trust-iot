import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { getAccessRequests } from "../services/dataService.js";

export default function AccessControlPage() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAccessRequests().then(setRequests);
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let allowed = 0;
    let denied = 0;
    requests.forEach((r) => {
      if (r.decision === "ALLOW") allowed++;
      else denied++;
    });
    return {
      total: requests.length,
      allowed,
      denied,
      passRate: requests.length > 0 ? Math.round((allowed / requests.length) * 100) : 0,
    };
  }, [requests]);

  // Resource breakdown bar chart data
  const resourceChartData = useMemo(() => {
    const map = {};
    requests.forEach((r) => {
      const res = r.resource || "Unknown";
      if (!map[res]) {
        map[res] = { resource: res, allowed: 0, denied: 0 };
      }
      if (r.decision === "ALLOW") map[res].allowed++;
      else map[res].denied++;
    });
    return Object.values(map);
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesSearch =
        r.device_id.toLowerCase().includes(search.toLowerCase()) ||
        r.resource.toLowerCase().includes(search.toLowerCase()) ||
        r.action.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (filter === "allow") return r.decision === "ALLOW";
      if (filter === "deny") return r.decision !== "ALLOW";
      return true;
    });
  }, [requests, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Access Control Policy Enforcement</h1>
          <p className="page-subtitle">
            Fine-grained role, resource, and action permission verification evaluated on-chain by AccessControl.sol rules.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid">
        <StatCard
          label="Total Policy Checks"
          value={metrics.total}
          tone="brand"
          trend={<span>Smart contract enforced</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          )}
        />
        <StatCard
          label="Access Granted"
          value={metrics.allowed}
          tone="allow"
          trend={<span>{metrics.passRate}% clearance rate</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Access Denied"
          value={metrics.denied}
          tone="deny"
          trend={<span>Unauthorized / Revoked / High Risk</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
        />
      </div>

      {/* Resource Breakdown Bar Chart */}
      <Panel title="Access Verdicts by Protected Resource" badge="Resource Bar Chart">
        {resourceChartData.length === 0 ? (
          <EmptyState>No access requests recorded yet.</EmptyState>
        ) : (
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="resource" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                <Bar dataKey="allowed" name="Granted (Allowed)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="denied" name="Denied (Blocked)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Search & Filter Controls */}
      <div className="controls-bar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by device, resource, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All ({requests.length})
          </button>
          <button className={`filter-pill ${filter === "allow" ? "active" : ""}`} onClick={() => setFilter("allow")}>
            Allowed ({metrics.allowed})
          </button>
          <button className={`filter-pill ${filter === "deny" ? "active" : ""}`} onClick={() => setFilter("deny")}>
            Denied ({metrics.denied})
          </button>
        </div>
      </div>

      <Panel title="Detailed Access Control Audit Log" badge={`${filteredRequests.length} Showing`}>
        {filteredRequests.length === 0 ? (
          <EmptyState>No access requests found.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Resource</th>
                  <th>Action</th>
                  <th>Risk Score</th>
                  <th>Decision</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.device_id}</strong></td>
                    <td>{r.resource}</td>
                    <td><span className="badge info">{r.action}</span></td>
                    <td>
                      <div className="risk-meter">
                        <div className="risk-meter-bar">
                          <div
                            className={`risk-meter-fill ${r.risk_score > 60 ? "high" : r.risk_score > 30 ? "medium" : "low"}`}
                            style={{ width: `${Math.min(100, (r.risk_score / 140) * 100)}%` }}
                          />
                        </div>
                        <span className="risk-score-num">{r.risk_score}</span>
                      </div>
                    </td>
                    <td><Badge tone={r.decision === "ALLOW" ? "allow" : "deny"}>{r.decision}</Badge></td>
                    <td className="muted">{new Date(r.timestamp).toLocaleString()}</td>
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
