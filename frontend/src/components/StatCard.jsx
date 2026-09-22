export default function StatCard({ label, value, tone = "brand", icon, trend }) {
  const toneClass = `tone-${tone}`;
  
  const color =
    tone === "allow" ? "var(--allow)" :
    tone === "deny" ? "var(--deny)" :
    tone === "warn" ? "var(--warn)" :
    tone === "purple" ? "var(--purple)" :
    "var(--brand)";

  return (
    <div className={`stat-card ${toneClass}`}>
      <div className="stat-card-top">
        <div className="label">{label}</div>
        {icon && <div className="icon">{icon}</div>}
      </div>
      <div className="value" style={{ color }}>{value}</div>
      {trend && <div className="trend">{trend}</div>}
    </div>
  );
}
