import type { ReactNode } from "react";
import type { QualityEvaluation } from "@crc/types";
import type {
  AgentDailyStat,
  AgentEvaluationGroup,
  DailyStat,
} from "./quality-analytics";
import { QualityDailyTrendChart } from "../components/quality/QualityCharts";
import {
  PdfExecutiveSummary,
  PdfExportPage,
  PdfKpiGrid,
  PdfReportHeader,
  PdfSectionTitle,
  PdfStatusPill,
  buildExecutiveSummaryText,
} from "./quality-pdf-shared";
import {
  fmtDate,
  rdvCriterionScore,
  CRITERION_EXACTITUDE,
  CRITERION_PROCEDURE,
} from "./quality-utils";

type GroupKpis = {
  count: number;
  avg: number;
  avgPercent: number;
  conformeRate: number;
  coaching: number;
  immediate: number;
};

type AgentStatRow = {
  id: string;
  name: string;
  count: number;
  avgScore: number;
  avgPercent: number;
  conformRate: number;
};

type DomainStatRow = {
  domain: string;
  avg: number;
  max: number;
  percent: number;
};

export type GroupExportMode = "pilotage" | "agent" | "history";

type Props = {
  mode: GroupExportMode;
  title: string;
  periodLabel: string;
  filterSummary: string;
  generatedAt: string;
  kpis: GroupKpis;
  keyScorePeriod: { exactitude: number | null; procedure: number | null };
  agentStats: AgentStatRow[];
  agentDailyStats: AgentDailyStat[];
  agentGroups: AgentEvaluationGroup[];
  domainStats: DomainStatRow[];
  dailyStats: DailyStat[];
  evaluatorDisplay: (evaluator: QualityEvaluation["evaluator"]) => string;
};

function kpiItems(kpis: GroupKpis, keyScorePeriod: Props["keyScorePeriod"]) {
  return [
    { label: "Écoutes", value: String(kpis.count), highlight: true },
    { label: "Moy. /20", value: String(kpis.avg), highlight: true },
    { label: "Moy. %", value: `${kpis.avgPercent}%` },
    { label: "Conformité", value: `${kpis.conformeRate}%`, highlight: kpis.conformeRate >= 80 },
    { label: "Exactitude", value: keyScorePeriod.exactitude != null ? `${keyScorePeriod.exactitude}%` : "—" },
    { label: "Procédure", value: keyScorePeriod.procedure != null ? `${keyScorePeriod.procedure}%` : "—" },
    { label: "Coaching", value: String(kpis.coaching) },
    { label: "Action imm.", value: String(kpis.immediate) },
  ];
}

function GroupTable({
  headers,
  rows,
  compact,
}: {
  headers: string[];
  rows: ReactNode[][];
  compact?: boolean;
}) {
  return (
    <table className={`pdf-table pdf-table-zebra ${compact ? "pdf-table-compact" : ""}`}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QualityGroupExport({
  mode,
  title,
  periodLabel,
  filterSummary,
  generatedAt,
  kpis,
  keyScorePeriod,
  agentStats,
  agentDailyStats,
  agentGroups,
  domainStats,
  dailyStats,
  evaluatorDisplay,
}: Props) {
  const kind = mode === "history" ? "history" : "group";

  const executiveText = buildExecutiveSummaryText({
    count: kpis.count,
    agentCount: agentStats.length,
    avg: kpis.avg,
    avgPercent: kpis.avgPercent,
    conformeRate: kpis.conformeRate,
    coaching: kpis.coaching,
    immediate: kpis.immediate,
    exactitudePct: keyScorePeriod.exactitude,
    procedurePct: keyScorePeriod.procedure,
    periodLabel,
  });

  const flatEvaluations = agentGroups.flatMap((g) =>
    g.evaluations.map((ev) => ({ ev, agentName: g.agentName })),
  );

  const showChart = dailyStats.length >= 2 && dailyStats.length <= 45;

  return (
    <div className="pdf-document pdf-document-compact">
      <PdfExportPage>
        <PdfReportHeader
          kind={kind}
          title={title}
          subtitle="Transmission hiérarchique"
          periodLabel={periodLabel}
          filterSummary={filterSummary}
          generatedAt={generatedAt}
          compact
        />
        <PdfKpiGrid items={kpiItems(kpis, keyScorePeriod)} compact />
        <PdfExecutiveSummary text={executiveText} />

        {agentStats.length > 0 && (
          <>
            <PdfSectionTitle>Synthèse par conseiller</PdfSectionTitle>
            <GroupTable
              compact
              headers={["Conseiller", "Écoutes", "Moy./20", "Moy.%", "Conf."]}
              rows={agentStats.map((a) => [
                a.name,
                a.count,
                a.avgScore,
                `${a.avgPercent}%`,
                `${a.conformRate}%`,
              ])}
            />
          </>
        )}

        {domainStats.length > 0 && (
          <>
            <PdfSectionTitle>Performance par domaine</PdfSectionTitle>
            <GroupTable
              compact
              headers={["Domaine", "Moy.", "Max", "%"]}
              rows={domainStats.map((d) => [d.domain, `${d.avg}`, `${d.max}`, `${d.percent}%`])}
            />
          </>
        )}

        {showChart && (
          <>
            <PdfSectionTitle>Évolution des scores</PdfSectionTitle>
            <div className="pdf-chart-inline">
              <QualityDailyTrendChart data={dailyStats} variant="print" fixedWidth={720} />
            </div>
          </>
        )}

        {agentDailyStats.length > 0 && (
          <>
            <PdfSectionTitle>Suivi par conseiller et par jour</PdfSectionTitle>
            <GroupTable
              compact
              headers={["Conseiller", "Date", "Écoutes", "Moy./20", "Moy.%"]}
              rows={agentDailyStats.map((row) => [
                row.agentName,
                row.dateLabel,
                row.count,
                row.avgScore,
                `${row.avgPercent}%`,
              ])}
            />
          </>
        )}

        {flatEvaluations.length > 0 && (
          <>
            <PdfSectionTitle>Détail des écoutes</PdfSectionTitle>
            <GroupTable
              compact
              headers={["Conseiller", "Date", "Score", "Exact.", "Proc.", "Statut", "Coach"]}
              rows={flatEvaluations.map(({ ev, agentName }) => {
                const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
                const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
                return [
                  agentName,
                  fmtDate(ev.evaluatedAt.slice(0, 10)),
                  `${ev.finalScore}/20`,
                  exactScore ?? "—",
                  procScore ?? "—",
                  <PdfStatusPill key="st" status={ev.status} />,
                  evaluatorDisplay(ev.evaluator),
                ];
              })}
            />
          </>
        )}
      </PdfExportPage>
    </div>
  );
}

export function buildGroupPdfFilename(mode: GroupExportMode, label: string, dateFrom: string, dateTo: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 36);
  const from = dateFrom || "debut";
  const to = dateTo || "fin";
  const today = new Date().toISOString().slice(0, 10);
  if (mode === "pilotage") return `Rapport_pilotage_qualite_${from}_${to}_${today}.pdf`;
  if (mode === "agent") return `Rapport_conseiller_${slug}_${from}_${to}_${today}.pdf`;
  return `Rapport_historique_qualite_${from}_${to}_${today}.pdf`;
}
