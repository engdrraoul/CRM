import type { ReactNode } from "react";

export type PdfReportKind = "individual" | "group" | "history";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Conforme: { bg: "#dcfce7", color: "#15803d" },
  "Coaching prioritaire": { bg: "#fef9c3", color: "#a16207" },
  "Action immédiate": { bg: "#fee2e2", color: "#b91c1c" },
};

export function pdfStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: "#f1f5f9", color: "#475569" };
}

export function PdfExportPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-pdf-section className={`pdf-page ${className ?? ""}`.trim()}>
      {children}
    </section>
  );
}

export function PdfReportHeader({
  kind,
  title,
  subtitle,
  periodLabel,
  filterSummary,
  generatedAt,
  compact,
}: {
  kind: PdfReportKind;
  title: string;
  subtitle?: string;
  periodLabel?: string;
  filterSummary?: string;
  generatedAt: string;
  compact?: boolean;
}) {
  const kindLabel =
    kind === "individual"
      ? "Fiche d'écoute qualité"
      : kind === "history"
        ? "Rapport historique qualité"
        : "Rapport de pilotage qualité";

  return (
    <header className={`pdf-header ${compact ? "pdf-header-compact" : ""}`}>
      <div className="pdf-header-brand">
        <span className="pdf-header-logo">CRC</span>
        <div>
          <div className="pdf-header-kind">{kindLabel}</div>
          <h1 className="pdf-header-title">{title}</h1>
          {subtitle && <p className="pdf-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="pdf-header-meta">
        {periodLabel && <div>{periodLabel}</div>}
        {filterSummary && <div className="pdf-header-filters">{filterSummary}</div>}
        <div className="pdf-header-date">Édité le {generatedAt}</div>
      </div>
    </header>
  );
}

export function PdfReportFooter({ docRef }: { docRef?: string }) {
  return (
    <footer className="pdf-footer">
      <span>Document confidentiel — Usage interne CRC</span>
      {docRef && <span className="pdf-footer-ref">Réf. {docRef.slice(0, 8)}</span>}
    </footer>
  );
}

export function PdfSectionTitle({
  index,
  children,
  hint,
}: {
  index?: number;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="pdf-section-title">
      {index != null && <span className="pdf-section-index">{index}</span>}
      <div>
        <h3>{children}</h3>
        {hint && <p className="pdf-section-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function PdfScoreHero({
  score,
  percent,
  mention,
  status,
  label = "Score écoute",
}: {
  score: number;
  percent: number;
  mention: string;
  status: string;
  label?: string;
}) {
  const st = pdfStatusStyle(status);
  return (
    <div className="pdf-score-hero">
      <div className="pdf-score-main">
        <span className="pdf-score-label">{label}</span>
        <div className="pdf-score-value">
          {score}
          <small>/20</small>
        </div>
        <span className="pdf-score-percent">{percent}%</span>
      </div>
      <div className="pdf-score-side">
        <div className="pdf-score-mention">{mention}</div>
        <span className="pdf-status-pill" style={{ background: st.bg, color: st.color }}>
          {status}
        </span>
      </div>
    </div>
  );
}

type KpiItem = { label: string; value: string; highlight?: boolean };

export function PdfKpiGrid({ items, compact }: { items: KpiItem[]; compact?: boolean }) {
  return (
    <div className={`pdf-kpi-grid ${compact ? "pdf-kpi-grid-compact" : ""}`}>
      {items.map((k) => (
        <div key={k.label} className={`pdf-kpi ${k.highlight ? "highlight" : ""}`}>
          <span className="pdf-kpi-label">{k.label}</span>
          <strong className="pdf-kpi-value">{k.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function PdfExecutiveSummary({ text }: { text: string }) {
  return (
    <div className="pdf-executive">
      <h3 className="pdf-executive-heading">Synthèse direction</h3>
      <p className="pdf-executive-text">{text}</p>
    </div>
  );
}

export function PdfMetaGrid({ rows, compact }: { rows: { label: string; value: string }[][]; compact?: boolean }) {
  return (
    <div className={`pdf-meta-grid ${compact ? "pdf-meta-grid-compact" : ""}`}>
      {rows.map((pair, i) => (
        <div key={i} className="pdf-meta-row">
          {pair.map((cell) => (
            <div key={cell.label} className="pdf-meta-cell">
              <span className="pdf-meta-label">{cell.label}</span>
              <span className="pdf-meta-value">{cell.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PdfStatusPill({ status }: { status: string }) {
  const st = pdfStatusStyle(status);
  return (
    <span className="pdf-status-pill pdf-status-pill-sm" style={{ background: st.bg, color: st.color }}>
      {status}
    </span>
  );
}

export function buildExecutiveSummaryText(opts: {
  count: number;
  agentCount: number;
  avg: number;
  avgPercent: number;
  conformeRate: number;
  coaching: number;
  immediate: number;
  exactitudePct: number | null;
  procedurePct: number | null;
  periodLabel: string;
}): string {
  const parts = [
    `Sur ${opts.periodLabel}, ${opts.count} écoute${opts.count > 1 ? "s" : ""} qualité ${opts.count > 1 ? "ont été réalisées" : "a été réalisée"} auprès de ${opts.agentCount} conseiller${opts.agentCount > 1 ? "s" : ""}.`,
    `Le score moyen s'établit à ${opts.avg}/20 (${opts.avgPercent}%), avec un taux de conformité de ${opts.conformeRate}%.`,
  ];
  if (opts.exactitudePct != null || opts.procedurePct != null) {
    const rdv = [
      opts.exactitudePct != null ? `exactitude RDV ${opts.exactitudePct}%` : null,
      opts.procedurePct != null ? `respect procédure ${opts.procedurePct}%` : null,
    ]
      .filter(Boolean)
      .join(" et ");
    parts.push(`Les indicateurs RDV affichent une ${rdv}.`);
  }
  if (opts.coaching > 0) {
    parts.push(
      `${opts.coaching} écoute${opts.coaching > 1 ? "s" : ""} ${opts.coaching > 1 ? "nécessitent" : "nécessite"} un coaching prioritaire.`,
    );
  }
  if (opts.immediate > 0) {
    parts.push(
      `${opts.immediate} écoute${opts.immediate > 1 ? "s" : ""} ${opts.immediate > 1 ? "requièrent" : "requiert"} une action immédiate.`,
    );
  }
  if (opts.coaching === 0 && opts.immediate === 0 && opts.conformeRate >= 80) {
    parts.push("La performance globale est satisfaisante sur la période.");
  }
  return parts.join(" ");
}

export function buildIndividualSummaryText(opts: {
  agentName: string;
  score: number;
  percent: number;
  mention: string;
  status: string;
  evaluatorName: string;
  evaluatedAt: string;
}): string {
  return `${opts.agentName} a été évalué(e) le ${opts.evaluatedAt} par ${opts.evaluatorName}. La note obtenue est de ${opts.score}/20 (${opts.percent}%), mention « ${opts.mention} » — statut ${opts.status}. Ce document détaille la grille critériée et le débrief associé.`;
}
