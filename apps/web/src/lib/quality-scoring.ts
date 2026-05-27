import type { QualityComputed, QualityCriterion, QualityReferentialConfig, QualityScores } from "@crc/types";
import { DEFAULT_QUALITY_REFERENTIAL } from "./quality-config-default";

export const QUALITY_CHANNELS = [
  "Appel entrant",
  "Appel sortant",
  "Message",
  "Email",
  "Autre",
] as const;

export function getDefaultReferential(): QualityReferentialConfig {
  return structuredClone(DEFAULT_QUALITY_REFERENTIAL);
}

export function scoreOptions(criterion: QualityCriterion): number[] {
  const base = [-1, 0, 1, 2];
  return criterion.allowThree ? [...base, 3] : base;
}

function mentionFor(score: number, t: QualityReferentialConfig["thresholds"]): string {
  if (score >= t.mentionExcellent) return "Excellent";
  if (score >= t.mentionTresSatisfaisant) return "Très satisfaisant";
  if (score >= t.mentionSatisfaisant) return "Satisfaisant";
  if (score >= t.mentionAmeliorer) return "À améliorer";
  return "Médiocre";
}

function shortLabel(criterion: QualityCriterion): string {
  if (criterion.id === "accueil_ton") return "Accueil: Courtoisie";
  if (criterion.id === "identite_rgpd") return "Identification: Identité/RGPD";
  if (criterion.id === "rdv_exactitude") return "RDV: Exactitude";
  if (criterion.id === "rdv_procedure") return "RDV: Procédure";
  if (criterion.id === "communication_clarte") return "Communication: Clarté";
  if (criterion.id === "communication_ecoute") return "Communication: Écoute";
  if (criterion.id.startsWith("conclusion_")) {
    return `Conclusion: ${criterion.name.split(" ")[0]}`;
  }
  return `${criterion.domain}: ${criterion.name.split(" ")[0]}`;
}

export function computeQualityResult(
  scores: QualityScores,
  config: QualityReferentialConfig = DEFAULT_QUALITY_REFERENTIAL,
): QualityComputed {
  const { criteria, thresholds: t } = config;
  let totalPoints = 0;
  let hasMinusOne = false;
  let blockingFail = false;
  const improvementParts: string[] = [];

  for (const criterion of criteria) {
    const raw = scores[criterion.id];
    const score = typeof raw === "number" ? raw : 0;
    totalPoints += score;
    if (score === -1) hasMinusOne = true;
    if (criterion.blocking && score < 2) blockingFail = true;
    if (score < criterion.maxPoints) {
      improvementParts.push(shortLabel(criterion));
    }
  }

  let cap = 20;
  if (hasMinusOne) cap = Math.min(cap, t.plafondMinusOne);
  if (blockingFail) cap = Math.min(cap, t.plafondBlocking);

  const finalScore = Math.min(totalPoints, cap);
  const immediateAction = hasMinusOne || blockingFail;
  const coachingPriority = finalScore < t.coachingMax && !immediateAction;
  const conform = finalScore >= t.conformeMin && !immediateAction;

  let status: string;
  if (immediateAction) status = "Action immédiate";
  else if (conform) status = "Conforme";
  else status = "Coaching prioritaire";

  return {
    totalPoints,
    finalScore,
    finalPercent: Math.round((finalScore / 20) * 1000) / 10,
    mention: mentionFor(finalScore, t),
    status,
    improvementAreas: improvementParts.join(" | "),
    coachingPriority,
    immediateAction,
    conform,
    hasMinusOne,
    blockingFail,
    cap,
  };
}

export function emptyQualityScores(config: QualityReferentialConfig = DEFAULT_QUALITY_REFERENTIAL): QualityScores {
  const scores: QualityScores = {};
  for (const c of config.criteria) scores[c.id] = 2;
  return scores;
}

export function domainGroups(config: QualityReferentialConfig = DEFAULT_QUALITY_REFERENTIAL) {
  const order = ["Accueil", "Identification", "Gestion RDV", "Communication", "Conclusion"];
  return order.map((domain) => ({
    domain,
    criteria: config.criteria.filter((c) => c.domain === domain),
  }));
}

export function domainScore(
  scores: QualityScores,
  criteria: QualityCriterion[],
): { points: number; max: number; percent: number } {
  const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
  const points = criteria.reduce((s, c) => s + (typeof scores[c.id] === "number" ? scores[c.id] : 0), 0);
  return { points, max, percent: max ? Math.round((points / max) * 1000) / 10 : 0 };
}

export function rubricLabel(criterion: QualityCriterion, score: number): string | undefined {
  return criterion.rubrics?.[String(score)];
}
