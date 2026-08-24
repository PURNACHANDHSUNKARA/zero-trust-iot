import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { getSecurityEvents } from "../services/dataService.js";

function severityTone(sev) {
  if (sev === "HIGH") return "high";
  if (sev === "MEDIUM") return "medium";
  return "low";
}

const SEVERITY_COLORS = {
  HIGH: "#f43f5e",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

export default function SecurityEvents() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getSecurityEvents().then(setEvents);
  }, []);

  const metrics = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    events.forEach((e) => {
      if (e.severity === "HIGH") high++;
      else if (e.severity === "MEDIUM") medium++;
      else low++;
    });
    return { total: events.length, high, medium, low };
  }, [events]);

  const severityChartData = useMemo(() => {
    return [
      { name: "HIGH", count: metrics.high, color: "#f43f5e" },
      { name: "MEDIUM", count: metrics.medium, color: "#f59e0b" },
      { name: "LOW", count: metrics.low, color: "#10b981" },
    ];
  }, [metrics]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        (e.device_id && e.device_id.toLowerCase().includes(search.toLowerCase())) ||
        (e.event_type && e.event_type.toLowerCase().includes(search.toLowerCase())) ||
        (e.description && e.description.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filter === "high") return e.severity === "HIGH";
      if (filter === "medium") return e.severity === "MEDIUM";
      if (filter === "low") return e.severity === "LOW";
      return true;
    });
  }, [events, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Security Anomalies & Incident Feed</h1>
          <p className="page-subtitle">
            Autonomous threat detection stream flagging anomalous telemetry patterns, replay violations, and unauthorized privilege escalations.
          </p>
        </div>
      </div>

      <div className="grid">
        <StatCard
          label="Total Security Alerts"
          value={metrics.total}
          tone="brand"
          trend={<span>Captured by real-time monitors</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          )}
        />
        <StatCard
          label="High Severity Incidents"
          value={metrics.high}
          tone="deny"
          trend={<span>Immediate isolation required</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
        />
        <StatCard
          label="Medium Warning Events"
          value={metrics.medium}
          tone="warn"
          trend={<span>Suspicious traffic thresholds</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
            </svg>
          )}
        />
      </div>

      <Panel title="Alert Distribution by Severity" badge="Severity Bar Chart">
        {events.length === 0 ? (
          <EmptyState>No security events flagged yet.</EmptyState>
        ) : (
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" name="Incidents" radius={[6, 6, 0, 0]}>
                  {severityChartData.map((entry, index) => (
                    <Cell key={`sev-${index}`} fill={entry.color} />
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
            placeholder="Search by device ID, event type, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All ({events.length})
          </button>
          <button className={`filter-pill ${filter === "high" ? "active" : ""}`} onClick={() => setFilter("high")}>
            High ({metrics.high})
          </button>
          <button className={`filter-pill ${filter === "medium" ? "active" : ""}`} onClick={() => setFilter("medium")}>
            Medium ({metrics.medium})
          </button>
          <button className={`filter-pill ${filter === "low" ? "active" : ""}`} onClick={() => setFilter("low")}>
            Low ({metrics.low})
          </button>
        </div>
      </div>

      <Panel title="Security Incident Audit Log" badge={`${filteredEvents.length} Showing`}>
        {filteredEvents.length === 0 ? (
          <EmptyState>No security events found.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Device</th>
                  <th>Event Type</th>
                  <th>Incident Description</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id}>
                    <td><Badge tone={severityTone(e.severity)}>{e.severity}</Badge></td>
                    <td><strong>{e.device_id || "SYSTEM"}</strong></td>
                    <td><span className="badge info">{e.event_type}</span></td>
                    <td style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>{e.description}</td>
                    <td className="muted">{new Date(e.timestamp).toLocaleString()}</td>
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
