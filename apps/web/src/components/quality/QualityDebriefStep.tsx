import { RefreshCw } from "lucide-react";
import type { QualityComputed } from "@crc/types";

type Props = {
  computed: QualityComputed;
  positivePoints: string;
  actionPlan: string;
  debriefDate: string;
  debriefConclusion: string;
  onPositiveChange: (v: string) => void;
  onActionPlanChange: (v: string) => void;
  onDebriefDateChange: (v: string) => void;
  onConclusionChange: (v: string) => void;
  onRegenerateActionPlan: () => void;
  onRegenerateConclusion: () => void;
};

export function QualityDebriefStep({
  computed,
  positivePoints,
  actionPlan,
  debriefDate,
  debriefConclusion,
  onPositiveChange,
  onActionPlanChange,
  onDebriefDateChange,
  onConclusionChange,
  onRegenerateActionPlan,
  onRegenerateConclusion,
}: Props) {
  return (
    <div className="quality-debrief-step">
      {computed.improvementAreas && (
        <div className="quality-debrief-axes">
          <h4>Axes d&apos;amélioration (auto)</h4>
          <p>{computed.improvementAreas}</p>
        </div>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Points forts</label>
          <textarea
            className="input"
            rows={2}
            value={positivePoints}
            onChange={(e) => onPositiveChange(e.target.value)}
            placeholder="Éléments positifs observés..."
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="quality-debrief-field-head">
            <label className="label">Plan d&apos;action</label>
            <button type="button" className="btn btn-secondary quality-regen-btn" onClick={onRegenerateActionPlan}>
              <RefreshCw size={14} />
              Régénérer
            </button>
          </div>
          <textarea
            className="input"
            rows={3}
            value={actionPlan}
            onChange={(e) => onActionPlanChange(e.target.value)}
            placeholder="Actions convenues avec le conseiller..."
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Date débrief</label>
          <input
            type="date"
            className="input"
            value={debriefDate}
            onChange={(e) => onDebriefDateChange(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="quality-debrief-field-head">
            <label className="label">Conclusion</label>
            <button type="button" className="btn btn-secondary quality-regen-btn" onClick={onRegenerateConclusion}>
              <RefreshCw size={14} />
              Régénérer
            </button>
          </div>
          <textarea
            className="input"
            rows={5}
            value={debriefConclusion}
            onChange={(e) => onConclusionChange(e.target.value)}
            placeholder="Conclusion managériale..."
          />
        </div>
      </div>
    </div>
  );
}
