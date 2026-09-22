import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge, { riskTone } from "../components/Badge.jsx";
import { getAccessRequests } from "../services/dataService.js";

function levelFromScore(score) {
  if (score > 60) return "HIGH";
  if (score > 30) return "MEDIUM";
  return "LOW";
}

export default function RiskAnalysis() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAccessRequests().then(setRequests);
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    if (!requests.length) return { total: 0, high: 0, medium: 0, low: 0, avg: 0, denied: 0 };
    let high = 0;
    let medium = 0;
    let low = 0;
    let sum = 0;
    let denied = 0;

    requests.forEach((r) => {
      sum += r.risk_score;
      if (r.risk_score > 60) high++;
      else if (r.risk_score > 30) medium++;
      else low++;
      if (r.decision !== "ALLOW") denied++;
    });

    return {
      total: requests.length,
      high,
      medium,
      low,
      avg: Math.round(sum / requests.length),
      denied,
    };
  }, [requests]);

  // Bar Chart Data: Group by Device with Average & Peak Risk
  const barChartData = useMemo(() => {
    const map = {};
    requests.forEach((r) => {
      if (!map[r.device_id]) {
        map[r.device_id] = { device: r.device_id, maxScore: r.risk_score, sum: r.risk_score, count: 1 };
      } else {
        map[r.device_id].maxScore = Math.max(map[r.device_id].maxScore, r.risk_score);
        map[r.device_id].sum += r.risk_score;
        map[r.device_id].count += 1;
      }
    });
    return Object.values(map).map((d) => ({
      device: d.device,
      score: d.maxScore,
      avg: Math.round(d.sum / d.count),
    }));
  }, [requests]);

  // Risk Distribution Data for Pie Chart
  const riskDistData = useMemo(() => {
    return [
      { name: "High Risk (>60)", value: metrics.high, color: "#f43f5e" },
      { name: "Medium Risk (31-60)", value: metrics.medium, color: "#f59e0b" },
      { name: "Low Risk (0-30)", value: metrics.low, color: "#10b981" },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Filter & Search Logic
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const level = levelFromScore(r.risk_score);
      const matchesSearch =
        r.device_id.toLowerCase().includes(search.toLowerCase()) ||
        (r.reason && r.reason.toLowerCase().includes(search.toLowerCase())) ||
        (r.resource && r.resource.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filter === "high") return level === "HIGH";
      if (filter === "medium") return level === "MEDIUM";
      if (filter === "low") return level === "LOW";
      if (filter === "denied") return r.decision === "DENY";
      if (filter === "allowed") return r.decision === "ALLOW";
      return true;
    });
  }, [requests, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Behavioral Risk Analysis</h1>
          <p className="page-subtitle">
            Continuous threat evaluation per request by risk_engine.py with real-time scoring, anomaly detection, and granular policy enforcement.
          </p>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid">
        <StatCard
          label="Total Evaluations"
          value={metrics.total}
          tone="brand"
          trend={<span>{metrics.denied} requests denied</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="High Risk Anomalies"
          value={metrics.high}
          tone="deny"
          trend={<span>Score &gt; 60 (Access Blocked)</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
        />
        <StatCard
          label="Medium Risk Alerts"
          value={metrics.medium}
          tone="warn"
          trend={<span>Score 31–60 (Role Warnings)</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
            </svg>
          )}
        />
        <StatCard
          label="Average Risk Score"
          value={metrics.avg}
          tone={metrics.avg > 60 ? "deny" : metrics.avg > 30 ? "warn" : "allow"}
          trend={<span>Baseline policy benchmark</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          )}
        />
      </div>

      {/* Visual Charts: Bar Chart Representation & Risk Distribution */}
      <div className="charts-grid-2">
        <Panel title="Peak Risk Score by IoT Device" badge="Bar Chart Telemetry">
          {barChartData.length === 0 ? (
            <EmptyState>No risk data to display.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <XAxis dataKey="device" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="score" name="Max Risk Score" radius={[6, 6, 0, 0]}>
                    {barChartData.map((entry, index) => {
                      const color = entry.score > 60 ? "#f43f5e" : entry.score > 30 ? "#f59e0b" : "#10b981";
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Risk Severity Breakdown" badge="Distribution">
          {riskDistData.length === 0 ? (
            <EmptyState>No risk data available.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
                    paddingAngle={4}
                    label={({ name, value }) => `${value}`}
                  >
                    {riskDistData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
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
      </div>

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
            placeholder="Search by device ID, resource, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All ({requests.length})
          </button>
          <button className={`filter-pill ${filter === "high" ? "active" : ""}`} onClick={() => setFilter("high")}>
            High Risk ({metrics.high})
          </button>
          <button className={`filter-pill ${filter === "medium" ? "active" : ""}`} onClick={() => setFilter("medium")}>
            Medium Risk ({metrics.medium})
          </button>
          <button className={`filter-pill ${filter === "low" ? "active" : ""}`} onClick={() => setFilter("low")}>
            Low Risk ({metrics.low})
          </button>
          <button className={`filter-pill ${filter === "denied" ? "active" : ""}`} onClick={() => setFilter("denied")}>
            Denied ({metrics.denied})
          </button>
          <button className={`filter-pill ${filter === "allowed" ? "active" : ""}`} onClick={() => setFilter("allowed")}>
            Allowed ({requests.length - metrics.denied})
          </button>
        </div>
      </div>

      {/* Main Table with Visual Risk Meter */}
      <Panel title="Evaluated Access & Risk Log" badge={`${filteredRequests.length} Showing`}>
        {filteredRequests.length === 0 ? (
          <EmptyState>No matching access requests found.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Reason & Diagnostic Policy Output</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const level = levelFromScore(r.risk_score);
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.device_id}</strong></td>
                      <td>
                        <div className="risk-meter">
                          <div className="risk-meter-bar">
                            <div
                              className={`risk-meter-fill ${level.toLowerCase()}`}
                              style={{ width: `${Math.min(100, (r.risk_score / 140) * 100)}%` }}
                            />
                          </div>
                          <span className="risk-score-num">{r.risk_score}</span>
                        </div>
                      </td>
                      <td>
                        <Badge tone={riskTone(level)}>{level}</Badge>
                      </td>
                      <td className="muted" style={{ lineHeight: 1.4, color: "var(--text-secondary)" }}>
                        {r.reason}
                      </td>
                      <td>
                        <Badge tone={r.decision === "ALLOW" ? "allow" : "deny"}>{r.decision}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
