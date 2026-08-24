import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import StatCard from "../components/StatCard.jsx";
import { Panel, EmptyState } from "../components/Panel.jsx";
import Badge, { riskTone } from "../components/Badge.jsx";
import {
  getDashboardStats,
  getAccessRequests,
  getDatasetStats,
  getDevices,
  getSecurityEvents
} from "../services/dataService.js";

const CHART_COLORS = ["#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#a855f7", "#06b6d4"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [datasetStats, setDatasetStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    getDashboardStats().then(setStats);
    getAccessRequests().then(setRequests);
    getDatasetStats().then(setDatasetStats);
    getDevices().then(setDevices);
    getSecurityEvents().then(setEvents);
  }, []);

  // Compute Device Access Requests Distribution (Allow vs Deny per Device)
  const deviceDecisionsData = useMemo(() => {
    if (!requests || requests.length === 0) return [];
    const map = {};
    requests.forEach((r) => {
      if (!map[r.device_id]) {
        map[r.device_id] = { device: r.device_id, allow: 0, deny: 0, total: 0 };
      }
      if (r.decision === "ALLOW") {
        map[r.device_id].allow += 1;
      } else {
        map[r.device_id].deny += 1;
      }
      map[r.device_id].total += 1;
    });
    return Object.values(map);
  }, [requests]);

  // Compute Risk Score Distribution by Device (Highest & Average risk score)
  const riskByDeviceData = useMemo(() => {
    if (!requests || requests.length === 0) return [];
    const map = {};
    requests.forEach((r) => {
      if (!map[r.device_id]) {
        map[r.device_id] = { device: r.device_id, maxScore: r.risk_score, count: 1, sum: r.risk_score };
      } else {
        map[r.device_id].maxScore = Math.max(map[r.device_id].maxScore, r.risk_score);
        map[r.device_id].count += 1;
        map[r.device_id].sum += r.risk_score;
      }
    });
    return Object.values(map).map((d) => ({
      device: d.device,
      maxScore: d.maxScore,
      avgScore: Math.round(d.sum / d.count),
    }));
  }, [requests]);

  // Access Ratio for Donut
  const decisionRatioData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Granted", value: stats.access_granted, color: "#10b981" },
      { name: "Denied", value: stats.access_denied, color: "#f43f5e" },
    ];
  }, [stats]);

  // Protocol Distribution
  const protocolData = useMemo(() => {
    if (!datasetStats?.protocol_distribution) return [];
    return Object.entries(datasetStats.protocol_distribution).map(([name, value]) => ({
      name,
      value,
    }));
  }, [datasetStats]);

  if (!stats) return null;

  const totalAccess = stats.access_granted + stats.access_denied;
  const accessPassRate = totalAccess > 0 ? Math.round((stats.access_granted / totalAccess) * 100) : 0;
  const totalAuth = stats.auth_success + stats.auth_failed;
  const authPassRate = totalAuth > 0 ? Math.round((stats.auth_success / totalAuth) * 100) : 0;

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Security & Trust Dashboard</h1>
          <p className="page-subtitle">
            Real-time Zero-Trust telemetry, decentralized device verification, and behavioural risk analytics.
          </p>
        </div>
      </div>

      {/* Banner */}
      <div className="banner info">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }}></span>
          <span><strong>Zero-Trust Engine Active:</strong> Continuous verification & Ed25519 signature validation running.</span>
        </div>
        <span className="badge allow">Live Protection</span>
      </div>

      {/* Top 8 Stat Cards */}
      <div className="grid">
        <StatCard
          label="Total Devices"
          value={stats.total_devices}
          tone="brand"
          trend={<span>{stats.active_devices} active &bull; {stats.revoked_devices} revoked</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
          )}
        />
        <StatCard
          label="Active Devices"
          value={stats.active_devices}
          tone="allow"
          trend={<span>Identity verified on-chain</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Revoked Devices"
          value={stats.revoked_devices}
          tone="deny"
          trend={<span>Immediate access block</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
        />
        <StatCard
          label="High-Risk Anomalies"
          value={stats.high_risk}
          tone="deny"
          trend={<span>Flagged for isolation</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
            </svg>
          )}
        />
        <StatCard
          label="Auth Success"
          value={stats.auth_success}
          tone="allow"
          trend={<span>{authPassRate}% auth pass rate</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          )}
        />
        <StatCard
          label="Auth Failures"
          value={stats.auth_failed}
          tone="deny"
          trend={<span>Invalid signature / replay</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <line x1="12" y1="8" x2="12" y2="12"></line>
            </svg>
          )}
        />
        <StatCard
          label="Access Granted"
          value={stats.access_granted}
          tone="allow"
          trend={<span>{accessPassRate}% request clearance</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Access Denied"
          value={stats.access_denied}
          tone="warn"
          trend={<span>Policy & permission checks</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          )}
        />
      </div>

      {/* Interactive Charts Section 1: Access Decisions & Risk Profile */}
      <div className="charts-grid-2">
        <Panel title="Zero-Trust Access Decisions by Device" badge="Policy Enforcement">
          {deviceDecisionsData.length === 0 ? (
            <EmptyState>No access requests recorded yet.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceDecisionsData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <XAxis dataKey="device" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                  <Bar dataKey="allow" name="Allowed (Passed)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deny" name="Denied (Blocked)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Device Risk Score Profile (0 - 150)" badge="Behavioral Risk Engine">
          {riskByDeviceData.length === 0 ? (
            <EmptyState>No risk data evaluated yet.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskByDeviceData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <XAxis dataKey="device" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                  <Bar dataKey="maxScore" name="Peak Risk Score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgScore" name="Avg Risk Score" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Interactive Charts Section 2: Donut Verdict & Protocol Distribution */}
      <div className="charts-grid-2">
        <Panel title="Access Decision Verdict Ratio" badge="Verdict Breakdown">
          {decisionRatioData.length === 0 ? (
            <EmptyState>No request data available.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionRatioData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {decisionRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Network Protocol Distribution" badge="Dataset Telemetry">
          {protocolData.length === 0 ? (
            <EmptyState>No protocol dataset available.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protocolData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" name="Packet Volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Recent Access Requests Stream */}
      <Panel title="Latest Zero-Trust Access Evaluations" badge={`${requests.length} Total Events`}>
        {requests.length === 0 ? (
          <EmptyState>No access requests recorded yet.</EmptyState>
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
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 6).map((r) => (
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
                    <td className="muted" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.reason}
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
