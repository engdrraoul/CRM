import type { QualityEvaluation, QualityReferentialConfig } from "@crc/types";
import type { AgentDailyStat, AgentChartPoint, DailyStat, DomainChartPoint } from "./quality-analytics";
import { QualityChartsGrid } from "../components/quality/QualityCharts";
import { domainGroups, rubricLabel } from "./quality-scoring";
import { fmtDate, fmtPercent, rdvCriterionPercent, rdvCriterionScore, CRITERION_EXACTITUDE, CRITERION_PROCEDURE, CRITERION_RDV_MAX } from "./quality-utils";

type PrintProps = {
  config: QualityReferentialConfig;
  evaluatedAt: string;
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

export function QualityPrintGrille({
  config,
  evaluatedAt,
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
}: PrintProps) {
  return (
    <div className="quality-print-grille">
      <div className="quality-print-header">
        <h2>Grille d&apos;écoute</h2>
        {externalCallId && (
          <p className="quality-print-id">ID appel Ubicentrex : {externalCallId}</p>
        )}
      </div>
      <table className="quality-print-meta">
        <tbody>
          <tr>
            <th>Date</th>
            <td>{fmtDate(evaluatedAt)}</td>
            <th>Agent</th>
            <td>{agentName}</td>
          </tr>
          <tr>
            <th>Évaluateur</th>
            <td>{evaluatorName}</td>
            <th>Projet / Campagne</th>
            <td>{campaignName || "—"}</td>
          </tr>
          <tr>
            <th>Canal</th>
            <td>{channel}</td>
            <th>ID appel</th>
            <td>{externalCallId || "—"}</td>
          </tr>
          <tr>
            <th>Score écoute</th>
            <td>
              <strong>{computed.finalScore}/20</strong> ({computed.finalPercent}%)
            </td>
            <th>Mention</th>
            <td>{computed.mention}</td>
          </tr>
          <tr>
            <th>Exactitude RDV</th>
            <td>
              {(() => {
                const s = rdvCriterionScore(scores, CRITERION_EXACTITUDE);
                if (s == null) return "—";
                const pct = rdvCriterionPercent(CRITERION_EXACTITUDE, s);
                return (
                  <>
                    <strong>{s}/{CRITERION_RDV_MAX}</strong>
                    {pct != null && <> ({pct}%)</>}
                  </>
                );
              })()}
            </td>
            <th>Respect procédure</th>
            <td>
              {(() => {
                const s = rdvCriterionScore(scores, CRITERION_PROCEDURE);
                if (s == null) return "—";
                const pct = rdvCriterionPercent(CRITERION_PROCEDURE, s);
                return (
                  <>
                    <strong>{s}/{CRITERION_RDV_MAX}</strong>
                    {pct != null && <> ({pct}%)</>}
                  </>
                );
              })()}
            </td>
          </tr>
          <tr>
            <th>Statut</th>
            <td>{computed.status}</td>
            <th>Réf. CRM</th>
            <td>{evaluationId ? `${evaluationId.slice(0, 8)}…` : "—"}</td>
          </tr>
        </tbody>
      </table>
      <table className="quality-print-table">
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Critère</th>
            <th>Max</th>
            <th>Score</th>
            <th>Commentaire / verbatim</th>
          </tr>
        </thead>
        <tbody>
          {domainGroups(config).flatMap(({ domain, criteria }) =>
            criteria.map((c, idx) => (
              <tr key={c.id}>
                <td>{idx === 0 ? domain : ""}</td>
                <td>
                  {c.name}
                  {c.blocking ? " [BLOQUANT]" : ""}
                </td>
                <td style={{ textAlign: "center" }}>{c.maxPoints}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{scores[c.id] ?? "—"}</td>
                <td>{comments[c.id] || rubricLabel(c, scores[c.id]) || ""}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="quality-print-footer">
        Total brut {computed.totalPoints}/20 — Note finale {computed.finalScore}/20 ({computed.finalPercent}%)
      </p>
      {(positivePoints || actionPlan || debriefConclusion || debriefDate) && (
        <div className="quality-print-debrief">
          <h3>Débrief conseiller</h3>
          {debriefDate && <p><strong>Date :</strong> {fmtDate(debriefDate)}</p>}
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
      )}
    </div>
  );
}

type PeriodKpis = {
  count: number;
  avg: number;
  avgPercent: number;
  conformeRate: number;
  coaching: number;
  immediate: number;
};

type AgentStatRow = {
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

type PeriodPrintProps = {
  title: string;
  periodLabel: string;
  filterSummary: string;
  kpis: PeriodKpis;
  keyScorePeriod: { exactitude: number | null; procedure: number | null };
  evaluations: QualityEvaluation[];
  agentStats?: AgentStatRow[];
  domainStats?: DomainStatRow[];
  agentDailyStats?: AgentDailyStat[];
  dailyStats?: DailyStat[];
  agentChartData?: AgentChartPoint[];
  domainChartData?: DomainChartPoint[];
  showCharts?: boolean;
  agentDisplay: (agent: QualityEvaluation["agent"]) => string;
  evaluatorDisplay: (evaluator: QualityEvaluation["evaluator"]) => string;
};

export function QualityPeriodPrint({
  title,
  periodLabel,
  filterSummary,
  kpis,
  keyScorePeriod,
  evaluations,
  agentStats,
  domainStats,
  agentDailyStats,
  dailyStats,
  agentChartData,
  domainChartData,
  showCharts = false,
  agentDisplay,
  evaluatorDisplay,
}: PeriodPrintProps) {
  const chartsDaily = dailyStats ?? [];
  const chartsAgent = agentChartData ?? [];
  const chartsDomain = domainChartData ?? [];
  return (
    <div className="quality-print-period">
      <h2>{title}</h2>
      <p className="quality-print-period-sub">
        {periodLabel}
        {filterSummary ? ` · ${filterSummary}` : ""}
      </p>

      <div className="quality-print-period-kpis">
        {[
          { label: "Écoutes", value: kpis.count },
          { label: "Moy. /20", value: kpis.avg },
          { label: "Moy. %", value: `${kpis.avgPercent}%` },
          { label: "Conformité", value: `${kpis.conformeRate}%` },
          { label: "Exactitude RDV", value: keyScorePeriod.exactitude != null ? `${keyScorePeriod.exactitude}%` : "—" },
          { label: "Respect procédure", value: keyScorePeriod.procedure != null ? `${keyScorePeriod.procedure}%` : "—" },
        ].map((k) => (
          <div key={k.label} className="quality-print-period-kpi">
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </div>
        ))}
      </div>

      {showCharts && (chartsDaily.length > 0 || chartsAgent.length > 0 || chartsDomain.length > 0) && (
        <div className="quality-print-period-section">
          <h3>Graphiques</h3>
          <QualityChartsGrid
            dailyData={chartsDaily}
            agentData={chartsAgent}
            domainData={chartsDomain}
            variant="print"
            fixedWidth={760}
          />
        </div>
      )}

      {agentDailyStats && agentDailyStats.length > 0 && (
        <div className="quality-print-period-section">
          <h3>Par conseiller et par jour</h3>
          <table className="quality-print-table">
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
              {agentDailyStats.map((row) => (
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
        </div>
      )}

      <div className="quality-print-period-section">
        <h3>Liste des écoutes</h3>
        <table className="quality-print-table">
          <thead>
            <tr>
              <th>Conseiller</th>
              <th>Date</th>
              <th>Écoute</th>
              <th>Exact.</th>
              <th>Proc.</th>
              <th>Statut</th>
              <th>Coach</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((ev) => {
              const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
              const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
              return (
                <tr key={ev.id}>
                  <td>{agentDisplay(ev.agent)}</td>
                  <td>{fmtDate(ev.evaluatedAt.slice(0, 10))}</td>
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
                  <td>{evaluatorDisplay(ev.evaluator)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {agentStats && agentStats.length > 0 && (
        <div className="quality-print-period-section">
          <h3>Par conseiller</h3>
          <table className="quality-print-table">
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
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>{a.count}</td>
                  <td>{a.avgScore}</td>
                  <td>{a.avgPercent}%</td>
                  <td>{a.conformRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {domainStats && domainStats.length > 0 && (
        <div className="quality-print-period-section">
          <h3>Par domaine</h3>
          <table className="quality-print-table">
            <thead>
              <tr>
                <th>Domaine</th>
                <th>Moyenne</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {domainStats.map((d) => (
                <tr key={d.domain}>
                  <td>{d.domain}</td>
                  <td>{d.avg}/{d.max}</td>
                  <td>{d.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function printQualityGrille(node: HTMLElement) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    window.print();
    return;
  }
  w.document.write(`
    <!DOCTYPE html>
    <html><head>
      <title>Grille d'écoute</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; }
        h2 { margin: 0 0 8px; font-size: 18px; }
        .quality-print-id { color: #64748b; font-size: 11px; margin: 0 0 16px; }
        .quality-print-meta { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .quality-print-meta th { text-align: left; width: 120px; color: #64748b; font-weight: 600; padding: 6px 8px; vertical-align: top; }
        .quality-print-meta td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        .quality-print-table { width: 100%; border-collapse: collapse; }
        .quality-print-table th, .quality-print-table td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
        .quality-print-table th { background: #f1f5f9; font-size: 11px; }
        .quality-print-footer { margin-top: 16px; font-weight: 600; }
        .quality-print-debrief { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        .quality-print-debrief h3 { margin: 0 0 8px; font-size: 14px; }
        .quality-print-debrief p { margin: 0 0 8px; line-height: 1.45; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>${node.innerHTML}</body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
