export function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR");
}

export function fmtPercent(score: number, max = 20) {
  return Math.round((score / max) * 1000) / 10;
}

export function statusBadge(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    Conforme: { bg: "rgba(34,197,94,0.12)", color: "#15803d" },
    "Coaching prioritaire": { bg: "rgba(234,179,8,0.15)", color: "#a16207" },
    "Action immédiate": { bg: "rgba(239,68,68,0.12)", color: "#b91c1c" },
  };
  const s = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
      {status}
    </span>
  );
}
