import type { QualityReferentialConfig } from "@crc/types";
import { domainGroups, rubricLabel } from "./quality-scoring";
import {
  PdfExportPage,
  PdfMetaGrid,
  PdfReportHeader,
  PdfScoreHero,
  PdfSectionTitle,
  buildIndividualSummaryText,
} from "./quality-pdf-shared";
import {
  fmtDate,
  rdvCriterionPercent,
  rdvCriterionScore,
  CRITERION_EXACTITUDE,
  CRITERION_PROCEDURE,
  CRITERION_RDV_MAX,
} from "./quality-utils";

export type IndividualExportProps = {
  config: QualityReferentialConfig;
  evaluatedAt: string;
  generatedAt: string;
  agentName: string;
  evaluatorName: string;
  campaignName: string;
  channel: string;
  externalCallId?: string | null;
  scores: Record<string, number>;
  comments: Record<string, string>;
  computed: {
    finalScore: number;
    finalPercent: number;
    mention: string;
    status: string;
    totalPoints: number;
  };
  evaluationId?: string;
  positivePoints?: string | null;
  actionPlan?: string | null;
  debriefDate?: string | null;
  debriefConclusion?: string | null;
};

function exactitudeLabel(scores: Record<string, number>) {
  const s = rdvCriterionScore(scores, CRITERION_EXACTITUDE);
  if (s == null) return "—";
  const pct = rdvCriterionPercent(CRITERION_EXACTITUDE, s);
  return pct != null ? `${s}/${CRITERION_RDV_MAX} (${pct}%)` : `${s}/${CRITERION_RDV_MAX}`;
}

function procedureLabel(scores: Record<string, number>) {
  const s = rdvCriterionScore(scores, CRITERION_PROCEDURE);
  if (s == null) return "—";
  const pct = rdvCriterionPercent(CRITERION_PROCEDURE, s);
  return pct != null ? `${s}/${CRITERION_RDV_MAX} (${pct}%)` : `${s}/${CRITERION_RDV_MAX}`;
}

function scoreCellClass(score: number | undefined, max: number) {
  if (score == null || score < 0) return "pdf-score-bad";
  const ratio = score / max;
  if (ratio >= 1) return "pdf-score-top";
  if (ratio >= 0.66) return "pdf-score-ok";
  if (ratio >= 0.33) return "pdf-score-warn";
  return "pdf-score-bad";
}

export function QualityIndividualExport(props: IndividualExportProps) {
  const {
    config,
    evaluatedAt,
    generatedAt,
    agentName,
    evaluatorName,
    campaignName,
    channel,
    externalCallId,
    scores,
    comments,
    computed,
    evaluationId,
    positivePoints,
    actionPlan,
    debriefDate,
    debriefConclusion,
  } = props;

  const dateLabel = fmtDate(evaluatedAt);
  const summary = buildIndividualSummaryText({
    agentName,
    score: computed.finalScore,
    percent: computed.finalPercent,
    mention: computed.mention,
    status: computed.status,
    evaluatorName,
    evaluatedAt: dateLabel,
  });

  const domainBlocks = domainGroups(config);
  const hasDebrief = !!(positivePoints || actionPlan || debriefConclusion || debriefDate);

  return (
    <div className="pdf-document pdf-document-compact">
      <PdfExportPage>
        <PdfReportHeader
          kind="individual"
          title={agentName}
          subtitle={`Écoute du ${dateLabel}`}
          generatedAt={generatedAt}
          compact
        />
        <PdfScoreHero
          score={computed.finalScore}
          percent={computed.finalPercent}
          mention={computed.mention}
          status={computed.status}
        />
        <p className="pdf-summary-text pdf-summary-text-compact">{summary}</p>
        <PdfMetaGrid
          compact
          rows={[
            [
              { label: "Conseiller", value: agentName },
              { label: "Coach qualité", value: evaluatorName },
            ],
            [
              { label: "Campagne", value: campaignName || "—" },
              { label: "Canal", value: channel },
            ],
            [
              { label: "Exactitude RDV", value: exactitudeLabel(scores) },
              { label: "Respect procédure", value: procedureLabel(scores) },
            ],
            [
              { label: "ID appel", value: externalCallId || "—" },
              { label: "Total brut", value: `${computed.totalPoints}/20` },
            ],
          ]}
        />

        <PdfSectionTitle index={2} hint="Grille critériée">
          Évaluation détaillée
        </PdfSectionTitle>
        {domainBlocks.map(({ domain, criteria }) => (
          <div key={domain} className="pdf-domain-block pdf-domain-block-compact">
            <div className="pdf-domain-header">{domain}</div>
            <table className="pdf-table pdf-table-compact">
              <thead>
                <tr>
                  <th>Critère</th>
                  <th className="pdf-th-num">Max</th>
                  <th className="pdf-th-num">Note</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => {
                  const sc = scores[c.id];
                  return (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        {c.blocking && <span className="pdf-tag-blocking">Bloquant</span>}
                      </td>
                      <td className="pdf-td-num">{c.maxPoints}</td>
                      <td className={`pdf-td-num pdf-td-score ${scoreCellClass(sc, c.maxPoints)}`}>
                        {sc ?? "—"}
                      </td>
                      <td className="pdf-td-comment">{comments[c.id] || rubricLabel(c, sc) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        <p className="pdf-grille-total pdf-grille-total-compact">
          Note finale : <strong>{computed.finalScore}/20</strong> ({computed.finalPercent}%)
          {evaluationId && <span className="pdf-ref-inline"> · Réf. {evaluationId.slice(0, 8)}</span>}
        </p>

        {hasDebrief && (
          <>
            <PdfSectionTitle index={3}>Débrief conseiller</PdfSectionTitle>
            <div className="pdf-debrief-block pdf-debrief-block-compact">
              {debriefDate && (
                <p><strong>Date :</strong> {fmtDate(debriefDate)}</p>
              )}
              {positivePoints && (
                <p><strong>Points forts :</strong> {positivePoints}</p>
              )}
              {actionPlan && (
                <p><strong>Plan d&apos;action :</strong> {actionPlan}</p>
              )}
              {debriefConclusion && (
                <p><strong>Conclusion :</strong> {debriefConclusion}</p>
              )}
            </div>
            <div className="pdf-signature-block pdf-signature-block-compact">
              <span>Coach : {evaluatorName}</span>
              <span>Conseiller : {agentName}</span>
            </div>
          </>
        )}
      </PdfExportPage>
    </div>
  );
}

export function buildIndividualPdfFilename(agentName: string, date: string): string {
  const slug = agentName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 40);
  return `Rapport_ecoute_${slug}_${date}.pdf`;
}
