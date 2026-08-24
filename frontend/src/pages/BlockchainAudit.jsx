import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { getAuditTrailOnChain, connectWallet, isContractDeployed } from "../services/blockchain.js";

export default function BlockchainAudit() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await connectWallet();
      const trail = await getAuditTrailOnChain(100);
      setEvents(trail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    let allowed = 0;
    let denied = 0;
    events.forEach((e) => {
      if (e.decision === "ALLOW") allowed++;
      else denied++;
    });
    return { total: events.length, allowed, denied };
  }, [events]);

  const auditChartData = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!map[e.deviceId]) {
        map[e.deviceId] = { device: e.deviceId, allowed: 0, denied: 0 };
      }
      if (e.decision === "ALLOW") map[e.deviceId].allowed++;
      else map[e.deviceId].denied++;
    });
    return Object.values(map);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        (e.deviceId && e.deviceId.toLowerCase().includes(search.toLowerCase())) ||
        (e.resource && e.resource.toLowerCase().includes(search.toLowerCase())) ||
        (e.action && e.action.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filter === "allow") return e.decision === "ALLOW";
      if (filter === "deny") return e.decision !== "ALLOW";
      return true;
    });
  }, [events, search, filter]);

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Immutable Blockchain Audit Trail</h1>
          <p className="page-subtitle">
            Cryptographically sealed audit records queried directly from AuditLog.sol on Ganache via MetaMask with zero intermediary backend.
          </p>
        </div>
      </div>

      {events.length > 0 && (
        <div className="grid">
          <StatCard
            label="Verified On-Chain Events"
            value={metrics.total}
            tone="brand"
            trend={<span>Immutable Solidity storage</span>}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            )}
          />
          <StatCard
            label="On-Chain Grants"
            value={metrics.allowed}
            tone="allow"
            trend={<span>Authorized policy compliance</span>}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          />
          <StatCard
            label="On-Chain Blocks"
            value={metrics.denied}
            tone="deny"
            trend={<span>Tamper-evident deny records</span>}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
          />
        </div>
      )}

      {events.length > 0 && auditChartData.length > 0 && (
        <Panel title="On-Chain Access Decisions by Device" badge="Blockchain Bar Chart">
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={auditChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                <Bar dataKey="allowed" name="Granted (On-Chain)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="denied" name="Blocked (On-Chain)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel
        title="On-Chain Ledger Events"
        badge={events.length ? `${filteredEvents.length} Loaded` : "MetaMask Connected"}
        action={
          <button className="action" onClick={load} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {loading ? "Querying Contracts..." : "Connect MetaMask & Load Trail"}
          </button>
        }
      >
        {!isContractDeployed("AuditLog") ? (
          <EmptyState>
            AuditLog.sol is not deployed yet. Run "npm run deploy" in blockchain/ (Phase 13).
          </EmptyState>
        ) : error ? (
          <EmptyState>{error}</EmptyState>
        ) : events.length === 0 ? (
          <EmptyState>Click "Connect MetaMask & Load Trail" to fetch on-chain events straight from Ganache.</EmptyState>
        ) : (
          <>
            <div style={{ padding: "12px 18px" }}>
              <div className="controls-bar" style={{ margin: 0 }}>
                <div className="search-input-wrapper">
                  <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search on-chain records..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="filter-pills">
                  <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                    All ({events.length})
                  </button>
                  <button className={`filter-pill ${filter === "allow" ? "active" : ""}`} onClick={() => setFilter("allow")}>
                    Allowed ({metrics.allowed})
                  </button>
                  <button className={`filter-pill ${filter === "deny" ? "active" : ""}`} onClick={() => setFilter("deny")}>
                    Denied ({metrics.denied})
                  </button>
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Protected Resource</th>
                    <th>Action</th>
                    <th>Decision</th>
                    <th>Block Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e, i) => (
                    <tr key={i}>
                      <td><strong>{e.deviceId}</strong></td>
                      <td>{e.resource}</td>
                      <td><span className="badge info">{e.action}</span></td>
                      <td><Badge tone={e.decision === "ALLOW" ? "allow" : "deny"}>{e.decision}</Badge></td>
                      <td className="muted">{new Date(e.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
