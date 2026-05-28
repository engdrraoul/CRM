export function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR");
}

export function fmtPercent(score: number, max = 20) {
  return Math.round((score / max) * 1000) / 10;
}

export const CRITERION_EXACTITUDE = "rdv_exactitude";
export const CRITERION_PROCEDURE = "rdv_procedure";
export const CRITERION_RDV_MAX = 3;

/** Barème métier (Excel 2_Base_Ecoutes) — note 2 = seuil conformité. */
const RDV_EXACTITUDE_PCT: Record<number, number> = {
  [-1]: 0,
  0: 40,
  1: 70,
  2: 93,
  3: 100,
};

const RDV_PROCEDURE_PCT: Record<number, number> = {
  [-1]: 0,
  0: 40,
  1: 70,
  2: 95,
  3: 100,
};

function rdvPercentMap(criterionId: string): Record<number, number> | null {
  if (criterionId === CRITERION_EXACTITUDE) return RDV_EXACTITUDE_PCT;
  if (criterionId === CRITERION_PROCEDURE) return RDV_PROCEDURE_PCT;
  return null;
}

export function rdvCriterionScore(scores: Record<string, number>, id: string): number | null {
  const v = scores[id];
  return typeof v === "number" ? v : null;
}

/** Pourcentage métier d'une note RDV (-1 à 3), pas score/3 linéaire. */
export function rdvCriterionPercent(criterionId: string, score: number): number | null {
  const map = rdvPercentMap(criterionId);
  if (!map || !(score in map)) return null;
  return map[score];
}

export function avgRdvCriterion(
  evaluations: { scores: Record<string, number> }[],
  id: string,
): { avg: number; pct: number } | null {
  let sum = 0;
  let sumPct = 0;
  let n = 0;
  for (const ev of evaluations) {
    const v = ev.scores[id];
    if (typeof v === "number") {
      const pct = rdvCriterionPercent(id, v);
      if (pct == null) continue;
      sum += v;
      sumPct += pct;
      n += 1;
    }
  }
  if (!n) return null;
  const avg = Math.round((sum / n) * 10) / 10;
  return { avg, pct: Math.round((sumPct / n) * 10) / 10 };
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
