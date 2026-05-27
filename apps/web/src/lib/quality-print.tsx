import type { QualityReferentialConfig } from "@crc/types";
import { domainGroups, rubricLabel } from "./quality-scoring";
import { fmtDate } from "./quality-utils";

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
            <th>Note /20</th>
            <td>
              <strong>{computed.finalScore}/20</strong> ({computed.finalPercent}%)
            </td>
            <th>Mention</th>
            <td>{computed.mention}</td>
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
        @media print { body { padding: 12px; } }
      </style>
    </head><body>${node.innerHTML}</body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
