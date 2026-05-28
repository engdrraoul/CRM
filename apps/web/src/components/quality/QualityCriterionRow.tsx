import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import type { QualityCriterion } from "@crc/types";
import { rubricLabel, scoreOptions } from "../../lib/quality-scoring";

type Props = {
  criterion: QualityCriterion;
  score: number;
  comment: string;
  onScoreChange: (score: number) => void;
  onCommentChange: (value: string) => void;
};

export function QualityCriterionRow({
  criterion,
  score,
  comment,
  onScoreChange,
  onCommentChange,
}: Props) {
  const [showExpected, setShowExpected] = useState(false);
  const [showComment, setShowComment] = useState(!!comment.trim());

  return (
    <div className="quality-criterion-compact">
      <div className="quality-criterion-compact-head">
        <div className="quality-criterion-compact-title">
          <span className="quality-criterion-name">{criterion.name}</span>
          {criterion.blocking && (
            <span className="badge quality-criterion-blocking">BLOQUANT</span>
          )}
          <span className="muted quality-criterion-max">/{criterion.maxPoints}</span>
        </div>
        <div className="quality-score-btns quality-score-btns-compact">
          {scoreOptions(criterion).map((s) => (
            <button
              key={s}
              type="button"
              title={rubricLabel(criterion, s)}
              className={`quality-score-btn ${s === -1 ? "minus" : ""} ${score === s ? "selected" : ""}`}
              onClick={() => onScoreChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {rubricLabel(criterion, score) && (
        <p className="quality-criterion-rubric">{rubricLabel(criterion, score)}</p>
      )}
      <button
        type="button"
        className="quality-criterion-toggle"
        onClick={() => setShowExpected((v) => !v)}
      >
        {showExpected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Voir attendu
      </button>
      {showExpected && (
        <p className="muted quality-criterion-expected">{criterion.expected}</p>
      )}
      {!showComment ? (
        <button
          type="button"
          className="quality-criterion-toggle"
          onClick={() => setShowComment(true)}
        >
          <MessageSquare size={14} />
          Commentaire
        </button>
      ) : (
        <div className="field quality-criterion-comment">
          <label className="label" style={{ fontSize: 12 }}>Commentaire</label>
          <textarea
            className="input"
            rows={2}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Verbatim ou observation..."
          />
        </div>
      )}
    </div>
  );
}
