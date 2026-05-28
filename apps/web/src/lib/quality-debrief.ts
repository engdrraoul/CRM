import type { QualityComputed } from "@crc/types";

function fmtDebriefDate(iso?: string | null): string {
  if (!iso) return new Date().toLocaleDateString("fr-FR");
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR");
}

export function buildActionPlanSuggestion(computed: QualityComputed): string {
  if (!computed.improvementAreas) {
    return "Maintenir le niveau actuel et capitaliser sur les points forts identifiés.";
  }
  const axes = computed.improvementAreas.split(" | ").filter(Boolean);
  const lines = axes.map((a) => `- Renforcer : ${a}`);
  if (computed.immediateAction) {
    lines.unshift("- Action immédiate : corriger les non-conformités majeures avant toute re-notation.");
  } else if (computed.coachingPriority) {
    lines.unshift("- Coaching prioritaire : session ciblée sur les axes ci-dessous.");
  }
  return lines.join("\n");
}

export function buildDebriefConclusion(opts: {
  agentName: string;
  computed: QualityComputed;
  actionPlan?: string | null;
  positivePoints?: string | null;
  debriefDate?: string | null;
}): string {
  const { agentName, computed, actionPlan, positivePoints, debriefDate } = opts;
  const dateLabel = fmtDebriefDate(debriefDate);
  const parts: string[] = [];

  parts.push(
    `Débrief du ${dateLabel} avec ${agentName} : ${computed.mention} (${computed.finalScore}/20, ${computed.finalPercent} %) — statut ${computed.status}.`,
  );

  if (positivePoints?.trim()) {
    parts.push(`Points forts : ${positivePoints.trim()}`);
  }

  if (computed.improvementAreas) {
    parts.push(`Axes d'amélioration : ${computed.improvementAreas}.`);
  }

  if (actionPlan?.trim()) {
    parts.push(`Plan d'action convenu : ${actionPlan.trim()}`);
  }

  if (computed.conform) {
    parts.push("Le conseiller est conforme sur cette écoute ; poursuivre le maintien des bonnes pratiques.");
  } else if (computed.immediateAction) {
    parts.push("Une action corrective immédiate est requise ; un point de suivi sera planifié.");
  } else {
    parts.push("Un coaching ciblé est prévu pour consolider les acquis.");
  }

  return parts.join("\n\n");
}
