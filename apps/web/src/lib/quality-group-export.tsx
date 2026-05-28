import type { ReactNode } from "react";
import type { QualityEvaluation } from "@crc/types";
import type {
  AgentChartPoint,
  AgentDailyStat,
  AgentEvaluationGroup,
  DailyStat,
  DomainChartPoint,
} from "./quality-analytics";
import { QualityChartsGrid } from "../components/quality/QualityCharts";
import {
  PdfExecutiveSummary,
  PdfExportPage,
  PdfKpiGrid,
  PdfReportFooter,
  PdfReportHeader,
  PdfSectionTitle,
  PdfStatusPill,
  buildExecutiveSummaryText,
} from "./quality-pdf-shared";
import {
  fmtDate,
  fmtPercent,
  rdvCriterionPercent,
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
  agentChartData: AgentChartPoint[];
  domainChartData: DomainChartPoint[];
  evaluatorDisplay: (evaluator: QualityEvaluation["evaluator"]) => string;
};

const ROWS_DAILY = 24;
const ROWS_AGENT = 16;

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (!rows.length) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function kpiItems(kpis: GroupKpis, keyScorePeriod: Props["keyScorePeriod"]) {
  return [
    { label: "Écoutes réalisées", value: String(kpis.count), highlight: true },
    { label: "Score moyen /20", value: String(kpis.avg), highlight: true },
    { label: "Score moyen %", value: `${kpis.avgPercent}%` },
    { label: "Taux conformité", value: `${kpis.conformeRate}%`, highlight: kpis.conformeRate >= 80 },
    { label: "Exactitude RDV", value: keyScorePeriod.exactitude != null ? `${keyScorePeriod.exactitude}%` : "—" },
    { label: "Respect procédure", value: keyScorePeriod.procedure != null ? `${keyScorePeriod.procedure}%` : "—" },
    { label: "Coaching prioritaire", value: String(kpis.coaching) },
    { label: "Action immédiate", value: String(kpis.immediate) },
  ];
}

function GroupTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="pdf-table pdf-table-zebra">
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
  agentChartData,
  domainChartData,
  evaluatorDisplay,
}: Props) {
  const kind = mode === "history" ? "history" : "group";
  const dailyChunks = chunkRows(agentDailyStats, ROWS_DAILY);
  const hasCharts = dailyStats.length > 0 || agentChartData.length > 1 || domainChartData.length > 0;

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

  let sectionIndex = 1;

  return (
    <div className="pdf-document">
      <PdfExportPage className="pdf-page-cover">
        <PdfReportHeader
          kind={kind}
          title={title}
          subtitle="Document de pilotage — transmission hiérarchique"
          periodLabel={periodLabel}
          filterSummary={filterSummary}
          generatedAt={generatedAt}
        />
        <PdfKpiGrid items={kpiItems(kpis, keyScorePeriod)} />
        <PdfExecutiveSummary text={executiveText} />
        <PdfReportFooter />
      </PdfExportPage>

      {agentStats.length > 0 && (
        <PdfExportPage>
          <PdfSectionTitle index={++sectionIndex}>Synthèse par conseiller</PdfSectionTitle>
          <GroupTable
            headers={["Conseiller", "Écoutes", "Moy. /20", "Moy. %", "Conformité"]}
            rows={agentStats.map((a) => [
              <strong key="n">{a.name}</strong>,
              a.count,
              <strong key="s">{a.avgScore}</strong>,
              `${a.avgPercent}%`,
              `${a.conformRate}%`,
            ])}
          />
          <PdfReportFooter />
        </PdfExportPage>
      )}

      {domainStats.length > 0 && (
        <PdfExportPage>
          <PdfSectionTitle index={++sectionIndex}>Performance par domaine</PdfSectionTitle>
          <GroupTable
            headers={["Domaine", "Moyenne", "Max", "Taux %"]}
            rows={domainStats.map((d) => [d.domain, `${d.avg}`, `${d.max}`, `${d.percent}%`])}
          />
          <PdfReportFooter />
        </PdfExportPage>
      )}

      {dailyChunks.map((chunk, idx) => (
        <PdfExportPage key={`daily-${idx}`}>
          <PdfSectionTitle index={++sectionIndex} hint={dailyChunks.length > 1 ? `Partie ${idx + 1}/${dailyChunks.length}` : undefined}>
            Suivi par conseiller et par jour
          </PdfSectionTitle>
          <GroupTable
            headers={["Conseiller", "Date", "Écoutes", "Moy. /20", "Moy. %"]}
            rows={chunk.map((row) => [
              row.agentName,
              row.dateLabel,
              row.count,
              row.avgScore,
              `${row.avgPercent}%`,
            ])}
          />
          <PdfReportFooter />
        </PdfExportPage>
      ))}

      {hasCharts && (
        <PdfExportPage className="pdf-page-charts">
          <PdfSectionTitle index={++sectionIndex}>Analyse graphique</PdfSectionTitle>
          <QualityChartsGrid
            dailyData={dailyStats}
            agentData={agentChartData}
            domainData={domainChartData}
            variant="print"
            fixedWidth={720}
          />
          <PdfReportFooter />
        </PdfExportPage>
      )}

      {agentGroups.map((group) => {
        const evalChunks = chunkRows(group.evaluations, ROWS_AGENT);
        return evalChunks.map((chunk, chunkIdx) => (
          <PdfExportPage key={`${group.agentId}-${chunkIdx}`}>
            <PdfSectionTitle
              index={++sectionIndex}
              hint={`${group.count} écoute${group.count > 1 ? "s" : ""} · moy. ${group.avgScore}/20 (${group.avgPercent}%)${evalChunks.length > 1 ? ` · ${chunkIdx + 1}/${evalChunks.length}` : ""}`}
            >
              Détail — {group.agentName}
            </PdfSectionTitle>
            <GroupTable
              headers={["Date", "Canal", "Score", "Exact.", "Proc.", "Statut", "Mention", "Coach"]}
              rows={chunk.map((ev) => {
                const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
                const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
                return [
                  fmtDate(ev.evaluatedAt.slice(0, 10)),
                  ev.channel,
                  <strong key="sc">{ev.finalScore}/20 ({ev.finalPercent ?? fmtPercent(ev.finalScore)}%)</strong>,
                  exactScore != null ? `${exactScore} (${rdvCriterionPercent(CRITERION_EXACTITUDE, exactScore)}%)` : "—",
                  procScore != null ? `${procScore} (${rdvCriterionPercent(CRITERION_PROCEDURE, procScore)}%)` : "—",
                  <PdfStatusPill key="st" status={ev.status} />,
                  ev.mention,
                  evaluatorDisplay(ev.evaluator),
                ];
              })}
            />
            <PdfReportFooter />
          </PdfExportPage>
        ));
      })}
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
