import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Printer, Save, Trash2 } from "lucide-react";
import type { Campaign, QualityComputed, QualityReferentialConfig } from "@crc/types";
import { QUALITY_CHANNELS, domainGroups, domainScore } from "../../lib/quality-scoring";
import {
  CRITERION_EXACTITUDE,
  CRITERION_PROCEDURE,
  CRITERION_RDV_MAX,
  rdvCriterionPercent,
  rdvCriterionScore,
} from "../../lib/quality-utils";
import { QualityCriterionRow } from "./QualityCriterionRow";
import { QualityDebriefStep } from "./QualityDebriefStep";

export type FormMode = "create" | "edit" | "renote";
export type FormStep = 1 | 2 | 3;

type PersonLite = { id: string; name: string | null; email: string };

type Props = {
  mode: FormMode;
  step: FormStep;
  onStepChange: (step: FormStep) => void;
  busy: boolean;
  referential: QualityReferentialConfig;
  computed: QualityComputed;
  agents: PersonLite[];
  campaigns: Campaign[];
  evaluatorLabel: string;
  evaluatorInitials: string;
  formExternalCallId: string;
  formDate: string;
  formAgentId: string;
  formCampaignId: string;
  formChannel: string;
  formScores: Record<string, number>;
  formComments: Record<string, string>;
  formPositive: string;
  formActionPlan: string;
  formDebriefDate: string;
  formDebriefConclusion: string;
  onExternalCallIdChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onAgentChange: (v: string) => void;
  onCampaignChange: (v: string) => void;
  onChannelChange: (v: string) => void;
  onScoreChange: (criterionId: string, score: number) => void;
  onCommentChange: (criterionId: string, value: string) => void;
  onPositiveChange: (v: string) => void;
  onActionPlanChange: (v: string) => void;
  onDebriefDateChange: (v: string) => void;
  onConclusionChange: (v: string) => void;
  onRegenerateActionPlan: () => void;
  onRegenerateConclusion: () => void;
  onSave: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  onDelete?: () => void;
  renoteBanner?: { agentName: string; evaluatedAt: string; previousScore: number } | null;
  statusBadge: (status: string) => ReactNode;
};

const STEP_LABELS: Record<FormStep, string> = {
  1: "Contexte",
  2: "Grille",
  3: "Débrief",
};

export function QualityFormWizard({
  mode,
  step,
  onStepChange,
  busy,
  referential,
  computed,
  agents,
  campaigns,
  evaluatorLabel,
  evaluatorInitials,
  formExternalCallId,
  formDate,
  formAgentId,
  formCampaignId,
  formChannel,
  formScores,
  formComments,
  formPositive,
  formActionPlan,
  formDebriefDate,
  formDebriefConclusion,
  onExternalCallIdChange,
  onDateChange,
  onAgentChange,
  onCampaignChange,
  onChannelChange,
  onScoreChange,
  onCommentChange,
  onPositiveChange,
  onActionPlanChange,
  onDebriefDateChange,
  onConclusionChange,
  onRegenerateActionPlan,
  onRegenerateConclusion,
  onSave,
  onPrint,
  onExportPdf,
  exportingPdf,
  onDelete,
  renoteBanner,
  statusBadge,
}: Props) {
  const [openDomain, setOpenDomain] = useState<string>(
    () => domainGroups(referential)[0]?.domain ?? "Accueil",
  );

  const exactScore = rdvCriterionScore(formScores, CRITERION_EXACTITUDE);
  const procScore = rdvCriterionScore(formScores, CRITERION_PROCEDURE);

  const canGoNext = step === 1 ? !!formAgentId : true;
  const saveLabel =
    mode === "renote" ? "Enregistrer re-notation" : mode === "edit" ? "Mettre à jour" : "Enregistrer";

  return (
    <div className="quality-wizard">
      {renoteBanner && (
        <div className="quality-renote-banner">
          <strong>Re-notation après coaching</strong>
          <span>
            {renoteBanner.agentName} · écoute du {renoteBanner.evaluatedAt} · score précédent{" "}
            {renoteBanner.previousScore}/20
          </span>
          <span className="muted">Mettez à jour la grille et le débrief, puis enregistrez.</span>
        </div>
      )}

      <nav className="quality-wizard-steps" aria-label="Étapes du formulaire">
        {([1, 2, 3] as FormStep[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`quality-wizard-step ${step === s ? "active" : ""} ${step > s ? "done" : ""}`}
            onClick={() => onStepChange(s)}
          >
            <span className="quality-wizard-step-num">{s}</span>
            {STEP_LABELS[s]}
          </button>
        ))}
      </nav>

      <div className="quality-form-layout">
        <aside className="quality-form-sidebar">
          <div className="quality-meta-card">
            <h3>Résultat live</h3>
            <div className="quality-score-panel">
              <div className="quality-score-box">
                <div className="label">Score écoute</div>
                <div className="value">{computed.finalScore}/20</div>
                <div className="sub">{computed.finalPercent}%</div>
              </div>
              <div className="quality-score-box">
                <div className="label">Exactitude</div>
                <div className="value">
                  {exactScore ?? "—"}
                  {exactScore != null && `/${CRITERION_RDV_MAX}`}
                </div>
                {exactScore != null && (
                  <div className="sub">{rdvCriterionPercent(CRITERION_EXACTITUDE, exactScore)}%</div>
                )}
              </div>
              <div className="quality-score-box">
                <div className="label">Procédure</div>
                <div className="value">
                  {procScore ?? "—"}
                  {procScore != null && `/${CRITERION_RDV_MAX}`}
                </div>
                {procScore != null && (
                  <div className="sub">{rdvCriterionPercent(CRITERION_PROCEDURE, procScore)}%</div>
                )}
              </div>
              <div className="quality-score-box">
                <div className="label">Mention · Statut</div>
                <div className="value" style={{ fontSize: "0.95rem" }}>{computed.mention}</div>
                <div style={{ marginTop: 6 }}>{statusBadge(computed.status)}</div>
              </div>
            </div>
            {(computed.hasMinusOne || computed.blockingFail) && (
              <div className="quality-alert">
                {computed.hasMinusOne && "Plafond -1 (max 8/20). "}
                {computed.blockingFail && "Plafond bloquant (max 12/20)."}
              </div>
            )}
          </div>
        </aside>

        <main className="quality-wizard-main">
          <div className="card">
            <div className="quality-evaluator-banner">
              <div className="avatar">{evaluatorInitials}</div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                  {mode === "create" ? "Évaluateur" : "Écoute réalisée par"}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{evaluatorLabel}</div>
              </div>
              {onPrint && (mode === "edit" || mode === "renote") && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={onPrint} disabled={exportingPdf}>
                    <Printer size={16} />
                    Imprimer
                  </button>
                  {onExportPdf && (
                    <button type="button" className="btn btn-secondary" onClick={onExportPdf} disabled={exportingPdf}>
                      <FileDown size={16} />
                      {exportingPdf ? "PDF…" : "Rapport PDF"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="quality-wizard-step-content">
                <h3 style={{ marginTop: 0 }}>Contexte de l&apos;écoute</h3>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">ID appel Ubicentrex</label>
                  <input
                    type="text"
                    className="input quality-call-id"
                    value={formExternalCallId}
                    onChange={(e) => onExternalCallIdChange(e.target.value)}
                    placeholder="Référence enregistrement"
                  />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={formDate} onChange={(e) => onDateChange(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Conseiller *</label>
                  <select className="select" value={formAgentId} onChange={(e) => onAgentChange(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name?.trim() || a.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Campagne</label>
                  <select className="select" value={formCampaignId} onChange={(e) => onCampaignChange(e.target.value)}>
                    <option value="">— Optionnel —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Canal</label>
                  <select className="select" value={formChannel} onChange={(e) => onChannelChange(e.target.value)}>
                    {QUALITY_CHANNELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="quality-wizard-step-content">
                <h3 style={{ marginTop: 0 }}>Grille de critères</h3>
                <div className="quality-domain-accordion">
                  {domainGroups(referential).map(({ domain, criteria }) => {
                    const ds = domainScore(formScores, criteria);
                    const isOpen = openDomain === domain;
                    return (
                      <div key={domain} className={`quality-domain-panel ${isOpen ? "open" : ""}`}>
                        <button
                          type="button"
                          className="quality-domain-panel-head"
                          onClick={() => setOpenDomain(isOpen ? "" : domain)}
                        >
                          <span>{domain}</span>
                          <span className="quality-domain-pill">{ds.points}/{ds.max} · {ds.percent}%</span>
                        </button>
                        {isOpen && (
                          <div className="quality-domain-panel-body">
                            {criteria.map((criterion) => (
                              <QualityCriterionRow
                                key={criterion.id}
                                criterion={criterion}
                                score={formScores[criterion.id] ?? 0}
                                comment={formComments[criterion.id] || ""}
                                onScoreChange={(s) => onScoreChange(criterion.id, s)}
                                onCommentChange={(v) => onCommentChange(criterion.id, v)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="quality-wizard-step-content">
                <h3 style={{ marginTop: 0 }}>Débrief conseiller</h3>
                <QualityDebriefStep
                  computed={computed}
                  positivePoints={formPositive}
                  actionPlan={formActionPlan}
                  debriefDate={formDebriefDate}
                  debriefConclusion={formDebriefConclusion}
                  onPositiveChange={onPositiveChange}
                  onActionPlanChange={onActionPlanChange}
                  onDebriefDateChange={onDebriefDateChange}
                  onConclusionChange={onConclusionChange}
                  onRegenerateActionPlan={onRegenerateActionPlan}
                  onRegenerateConclusion={onRegenerateConclusion}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="quality-wizard-bar">
        <div className="quality-wizard-bar-scores">
          <span><strong>{computed.finalScore}</strong>/20</span>
          {exactScore != null && (
            <span>Exact. {exactScore}/{CRITERION_RDV_MAX}</span>
          )}
          {procScore != null && (
            <span>Proc. {procScore}/{CRITERION_RDV_MAX}</span>
          )}
        </div>
        <div className="quality-wizard-bar-actions">
          {step > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => onStepChange((step - 1) as FormStep)}>
              <ChevronLeft size={16} />
              Précédent
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canGoNext}
              onClick={() => onStepChange((step + 1) as FormStep)}
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn btn-primary" disabled={busy || !formAgentId} onClick={onSave}>
              <Save size={18} />
              {busy ? "..." : saveLabel}
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
