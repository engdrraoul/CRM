import type { QualityComputed, QualityCriterion, QualityScores } from "@crc/types";

export const QUALITY_CHANNELS = [
  "Appel entrant",
  "Appel sortant",
  "Message",
  "Email",
  "Autre",
] as const;

export const QUALITY_CRITERIA: QualityCriterion[] = [
  {
    id: "accueil_salutation",
    domain: "Accueil",
    name: "Salutation professionnelle",
    maxPoints: 2,
    blocking: true,
    allowThree: false,
    expected:
      "Accueil clair : identification du cabinet + praticien, annonce du service, formule de politesse.",
  },
  {
    id: "accueil_ton",
    domain: "Accueil",
    name: "Ton & courtoisie (empathie)",
    maxPoints: 2,
    blocking: false,
    allowThree: false,
    expected: "Vouvoyer, ton calme et bienveillant, respect du patient et des contraintes.",
  },
  {
    id: "identite_rgpd",
    domain: "Identification",
    name: "Vérification identité patient (RGPD)",
    maxPoints: 2,
    blocking: true,
    allowThree: false,
    expected:
      "Vérifier identité avant toute info : NOM + prénom + date de naissance (ou autre procédure client).",
  },
  {
    id: "rdv_exactitude",
    domain: "Gestion RDV",
    name: "Exactitude des informations (RDV/consignes)",
    maxPoints: 3,
    blocking: true,
    allowThree: true,
    expected:
      "Informations exactes : motif, praticien, date/heure, lieu, consignes, vérification disponibilité.",
  },
  {
    id: "rdv_procedure",
    domain: "Gestion RDV",
    name: "Respect procédure client (outil / règles)",
    maxPoints: 3,
    blocking: true,
    allowThree: true,
    expected:
      "Application stricte des consignes (priorités, urgences, transferts, messages, délais).",
  },
  {
    id: "communication_clarte",
    domain: "Communication",
    name: "Clarté de l'expression (orale/écrite)",
    maxPoints: 2,
    blocking: false,
    allowThree: false,
    expected:
      "Message structuré : phrases courtes, vocabulaire simple, articulation, écrit sans ambiguïté.",
  },
  {
    id: "communication_ecoute",
    domain: "Communication",
    name: "Écoute active & reformulation",
    maxPoints: 2,
    blocking: false,
    allowThree: false,
    expected: "Laisse s'exprimer, questionne, reformule, confirme le besoin avant d'agir.",
  },
  {
    id: "conclusion_synthese",
    domain: "Conclusion",
    name: "Synthèse & confirmation (récap)",
    maxPoints: 2,
    blocking: false,
    allowThree: false,
    expected: "Récapitule : RDV/infos clés, consignes, prochaines étapes, vérifie l'accord.",
  },
  {
    id: "conclusion_cloture",
    domain: "Conclusion",
    name: "Clôture professionnelle",
    maxPoints: 2,
    blocking: false,
    allowThree: false,
    expected: "Remercie, formule de clôture, disponibilité, prise de congé propre.",
  },
];

const CRITERIA_BY_ID = Object.fromEntries(QUALITY_CRITERIA.map((c) => [c.id, c]));

export function scoreOptions(criterion: QualityCriterion): number[] {
  const base = [-1, 0, 1, 2];
  return criterion.allowThree ? [...base, 3] : base;
}

function mentionFor(score: number): string {
  if (score >= 18) return "Excellent";
  if (score >= 16) return "Très satisfaisant";
  if (score >= 14) return "Satisfaisant";
  if (score >= 12) return "À améliorer";
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

export function computeQualityResult(scores: QualityScores): QualityComputed {
  let totalPoints = 0;
  let hasMinusOne = false;
  let blockingFail = false;
  const improvementParts: string[] = [];

  for (const criterion of QUALITY_CRITERIA) {
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
  if (hasMinusOne) cap = Math.min(cap, 8);
  if (blockingFail) cap = Math.min(cap, 12);

  const finalScore = Math.min(totalPoints, cap);
  const immediateAction = hasMinusOne || blockingFail;
  const coachingPriority = finalScore < 14 && !immediateAction;
  const conform = finalScore >= 14 && !immediateAction;

  let status: string;
  if (immediateAction) status = "Action immédiate";
  else if (conform) status = "Conforme";
  else status = "Coaching prioritaire";

  return {
    totalPoints,
    finalScore,
    finalPercent: Math.round((finalScore / 20) * 1000) / 10,
    mention: mentionFor(finalScore),
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

export function emptyQualityScores(): QualityScores {
  const scores: QualityScores = {};
  for (const c of QUALITY_CRITERIA) scores[c.id] = 2;
  return scores;
}

export function domainGroups(): { domain: string; criteria: QualityCriterion[] }[] {
  const order = ["Accueil", "Identification", "Gestion RDV", "Communication", "Conclusion"];
  return order.map((domain) => ({
    domain,
    criteria: QUALITY_CRITERIA.filter((c) => c.domain === domain),
  }));
}

export function getCriterion(id: string): QualityCriterion | undefined {
  return CRITERIA_BY_ID[id];
}
