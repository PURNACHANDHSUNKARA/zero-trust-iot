export default function Badge({ children, tone }) {
  // tone: allow | deny | active | revoked | success | failed | low | medium | high | info
  return <span className={`badge ${tone || "info"}`}>{children}</span>;
}

export function riskTone(level) {
  if (!level) return "low";
  const l = level.toUpperCase();
  if (l === "HIGH") return "high";
  if (l === "MEDIUM") return "medium";
  return "low";
}

export function decisionTone(decision) {
  return decision === "ALLOW" || decision === "SUCCESS" || decision === "ACTIVE" ? "allow" : "deny";
}
