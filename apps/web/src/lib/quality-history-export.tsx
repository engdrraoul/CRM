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
  fmtDate,
  fmtPercent,
  rdvCriterionPercent,
  rdvCriterionScore,
  CRITERION_EXACTITUDE,
  CRITERION_PROCEDURE,
} from "./quality-utils";

type HistoryKpis = {
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

type Props = {
  periodLabel: string;
  filterSummary: string;
  generatedAt: string;
  kpis: HistoryKpis;
  keyScorePeriod: { exactitude: number | null; procedure: number | null };
  agentStats: AgentStatRow[];
  agentDailyStats: AgentDailyStat[];
  agentGroups: AgentEvaluationGroup[];
  dailyStats: DailyStat[];
  agentChartData: AgentChartPoint[];
  domainChartData: DomainChartPoint[];
  evaluatorDisplay: (evaluator: QualityEvaluation["evaluator"]) => string;
};

const ROWS_PER_DAILY_PAGE = 28;
const ROWS_PER_AGENT_PAGE = 18;

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (!rows.length) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function ExportPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section data-pdf-section className={`quality-history-export-page ${className ?? ""}`.trim()}>
      {children}
    </section>
  );
}

function KpiGrid({ kpis, keyScorePeriod }: { kpis: HistoryKpis; keyScorePeriod: Props["keyScorePeriod"] }) {
  return (
    <div className="quality-history-kpi-grid">
      {[
        { label: "Écoutes", value: String(kpis.count) },
        { label: "Moy. /20", value: String(kpis.avg) },
        { label: "Moy. %", value: `${kpis.avgPercent}%` },
        { label: "Conformité", value: `${kpis.conformeRate}%` },
        { label: "Exactitude RDV", value: keyScorePeriod.exactitude != null ? `${keyScorePeriod.exactitude}%` : "—" },
        { label: "Respect procédure", value: keyScorePeriod.procedure != null ? `${keyScorePeriod.procedure}%` : "—" },
        { label: "Coaching", value: String(kpis.coaching) },
        { label: "Action imm.", value: String(kpis.immediate) },
      ].map((k) => (
        <div key={k.label} className="quality-history-kpi">
          <span>{k.label}</span>
          <strong>{k.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function QualityHistoryExport({
  periodLabel,
  filterSummary,
  generatedAt,
  kpis,
  keyScorePeriod,
  agentStats,
  agentDailyStats,
  agentGroups,
  dailyStats,
  agentChartData,
  domainChartData,
  evaluatorDisplay,
}: Props) {
  const dailyChunks = chunkRows(agentDailyStats, ROWS_PER_DAILY_PAGE);
  const hasCharts = dailyStats.length > 0 || agentChartData.length > 0 || domainChartData.length > 0;

  return (
    <div className="quality-history-export">
      <ExportPage>
        <header className="quality-history-export-header">
          <h2>Historique des écoutes qualité</h2>
          <p className="quality-history-export-sub">{periodLabel}</p>
          {filterSummary && <p className="quality-history-export-filters">{filterSummary}</p>}
          <p className="quality-history-export-meta">Généré le {generatedAt}</p>
        </header>
        <KpiGrid kpis={kpis} keyScorePeriod={keyScorePeriod} />
      </ExportPage>

      {agentStats.length > 0 && (
        <ExportPage>
          <h3 className="quality-history-section-title">Synthèse par conseiller</h3>
          <table className="quality-print-table quality-history-table">
            <thead>
              <tr>
                <th>Conseiller</th>
                <th>Écoutes</th>
                <th>Moy. /20</th>
                <th>Moy. %</th>
                <th>Conformité</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.count}</td>
                  <td>{a.avgScore}</td>
                  <td>{a.avgPercent}%</td>
                  <td>{a.conformRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ExportPage>
      )}

      {dailyChunks.map((chunk, idx) => (
        <ExportPage key={`daily-${idx}`}>
          <h3 className="quality-history-section-title">
            Par conseiller et par jour
            {dailyChunks.length > 1 && ` (${idx + 1}/${dailyChunks.length})`}
          </h3>
          <table className="quality-print-table quality-history-table">
            <thead>
              <tr>
                <th>Conseiller</th>
                <th>Date</th>
                <th>Écoutes</th>
                <th>Moy. /20</th>
                <th>Moy. %</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((row) => (
                <tr key={`${row.agentId}-${row.date}`}>
                  <td>{row.agentName}</td>
                  <td>{row.dateLabel}</td>
                  <td>{row.count}</td>
                  <td>{row.avgScore}</td>
                  <td>{row.avgPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ExportPage>
      ))}

      {hasCharts && (
        <ExportPage className="quality-history-export-charts">
          <h3 className="quality-history-section-title">Graphiques</h3>
          <QualityChartsGrid
            dailyData={dailyStats}
            agentData={agentChartData}
            domainData={domainChartData}
            variant="print"
            fixedWidth={740}
          />
        </ExportPage>
      )}

      {agentGroups.map((group) => {
        const evalChunks = chunkRows(group.evaluations, ROWS_PER_AGENT_PAGE);
        return evalChunks.map((chunk, chunkIdx) => (
          <ExportPage key={`${group.agentId}-${chunkIdx}`}>
            <h3 className="quality-history-section-title">
              {group.agentName}
              <span className="quality-history-agent-sub">
                {group.count} écoute{group.count > 1 ? "s" : ""} · moy. {group.avgScore}/20 ({group.avgPercent}%)
                {evalChunks.length > 1 && ` · page ${chunkIdx + 1}/${evalChunks.length}`}
              </span>
            </h3>
            <table className="quality-print-table quality-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Canal</th>
                  <th>Score</th>
                  <th>Exact.</th>
                  <th>Proc.</th>
                  <th>Statut</th>
                  <th>Mention</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((ev) => {
                  const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
                  const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
                  return (
                    <tr key={ev.id}>
                      <td>{fmtDate(ev.evaluatedAt.slice(0, 10))}</td>
                      <td>{ev.channel}</td>
                      <td>
                        {ev.finalScore}/20 ({ev.finalPercent ?? fmtPercent(ev.finalScore)}%)
                      </td>
                      <td>
                        {exactScore ?? "—"}
                        {exactScore != null && ` (${rdvCriterionPercent(CRITERION_EXACTITUDE, exactScore)}%)`}
                      </td>
                      <td>
                        {procScore ?? "—"}
                        {procScore != null && ` (${rdvCriterionPercent(CRITERION_PROCEDURE, procScore)}%)`}
                      </td>
                      <td>{ev.status}</td>
                      <td>{ev.mention}</td>
                      <td>{evaluatorDisplay(ev.evaluator)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ExportPage>
        ));
      })}
    </div>
  );
}
