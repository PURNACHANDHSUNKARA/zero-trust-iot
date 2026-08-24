import { useEffect, useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import StatCard from "../components/StatCard.jsx";
import { Panel, EmptyState } from "../components/Panel.jsx";
import { getDatasetStats } from "../services/dataService.js";

const PROTOCOL_COLORS = ["#38bdf8", "#6366f1", "#10b981", "#f59e0b", "#a855f7", "#06b6d4"];

export default function DatasetAnalysis() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDatasetStats().then(setStats);
  }, []);

  const deviceDist = useMemo(() => {
    return Object.entries(stats?.device_distribution || {}).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const protoDist = useMemo(() => {
    return Object.entries(stats?.protocol_distribution || {}).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const trafficBreakdown = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Normal Traffic", value: stats.normal_records, color: "#10b981" },
      { name: "Attack / Anomaly", value: stats.attack_records, color: "#f43f5e" },
    ];
  }, [stats]);

  if (!stats) return null;

  const attackPercentage = stats.total_records > 0
    ? ((stats.attack_records / stats.total_records) * 100).toFixed(1)
    : 0;
  const normalPercentage = stats.total_records > 0
    ? ((stats.normal_records / stats.total_records) * 100).toFixed(1)
    : 0;

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Dataset Cybersecurity Telemetry</h1>
          <p className="page-subtitle">
            Comprehensive feature distribution and traffic volume analysis computed from imported IoT cybersecurity datasets (CICIoT2023 / ToN_IoT).
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid">
        <StatCard
          label="Total Telemetry Records"
          value={stats.total_records.toLocaleString()}
          tone="brand"
          trend={<span>Captured across 6 active devices</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          )}
        />
        <StatCard
          label="Normal Baseline Records"
          value={stats.normal_records.toLocaleString()}
          tone="allow"
          trend={<span>{normalPercentage}% clean baseline traffic</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Attack & Anomaly Records"
          value={stats.attack_records.toLocaleString()}
          tone="deny"
          trend={<span>{attackPercentage}% malicious traffic detected</span>}
          icon={(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid-2">
        <Panel title="Traffic Security Composition" badge="Normal vs Attack">
          {trafficBreakdown.length === 0 ? (
            <EmptyState>No dataset imported yet.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  >
                    {trafficBreakdown.map((entry, index) => (
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

        <Panel title="Protocol Volume Breakdown" badge="Bar Chart Telemetry">
          {protoDist.length === 0 ? (
            <EmptyState>No protocol dataset available.</EmptyState>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protoDist} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" name="Record Count" radius={[6, 6, 0, 0]}>
                    {protoDist.map((entry, i) => (
                      <Cell key={`proto-${i}`} fill={PROTOCOL_COLORS[i % PROTOCOL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Telemetry Records Per IoT Device" badge="Device Distribution Bar Chart">
        {deviceDist.length === 0 ? (
          <EmptyState>No dataset imported yet.</EmptyState>
        ) : (
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceDist} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name="Dataset Packets" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </>
  );
}
