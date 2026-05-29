import { useEffect, useState } from "react";
import type { DailyReport } from "@crc/types";
import { updateReportById } from "../db";
import { useAuth } from "../auth";
import { useAsync } from "../hooks/useAsync";
import { toast } from "sonner";
import {
  Save,
  Send,
  X,
  Calendar,
  Target,
  User,
  PhoneIncoming,
  PhoneOutgoing,
  CheckSquare,
  PhoneMissed,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";

type ReportFormState = {
  incomingTotal: number;
  outgoingTotal: number;
  handled: number;
  missed: number;
  rdvTotal: number;
  smsTotal: number;
  observations: string;
};

const EMPTY_FORM: ReportFormState = {
  incomingTotal: 0,
  outgoingTotal: 0,
  handled: 0,
  missed: 0,
  rdvTotal: 0,
  smsTotal: 0,
  observations: "",
};

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return "Brouillon";
    case "SUBMITTED": return "Soumis";
    case "VALIDATED": return "Validé";
    case "REJECTED": return "Rejeté";
    default: return status;
  }
}

export interface ReportEditModalProps {
  report: DailyReport | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ReportEditModal({ report, onClose, onSaved }: ReportEditModalProps) {
  const { user } = useAuth();
  const [state, setState] = useState<ReportFormState>(EMPTY_FORM);
  const [busy, run] = useAsync();

  useEffect(() => {
    if (!report) return;
    setState({
      incomingTotal: report.incomingTotal,
      outgoingTotal: report.outgoingTotal,
      handled: report.handled,
      missed: report.missed,
      rdvTotal: report.rdvTotal,
      smsTotal: report.smsTotal,
      observations: report.observations ?? "",
    });
  }, [report]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      handled: (Number(prev.incomingTotal) || 0) + (Number(prev.outgoingTotal) || 0),
    }));
  }, [state.incomingTotal, state.outgoingTotal]);

  useEffect(() => {
    if (!report) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [report, busy, onClose]);

  if (!report) return null;

  const isOwner = user?.id === report.user.id;
  const canSubmit = isOwner && (report.status === "DRAFT" || report.status === "REJECTED");

  async function save(submit = false) {
    if ([state.incomingTotal, state.outgoingTotal, state.handled, state.missed,
         state.rdvTotal, state.smsTotal].some((n) => n < 0)) {
      toast.error("Les valeurs ne peuvent pas être négatives");
      return;
    }

    await run(async () => {
      try {
        await updateReportById(report!.id, state, { submit });
        toast.success(submit ? "Rapport soumis avec succès !" : "Rapport modifié avec succès.");
        onSaved();
        onClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Impossible de modifier le rapport";
        toast.error(message);
      }
    });
  }

  const fields = [
    { id: "edit-incoming", label: "Appels reçus", icon: PhoneIncoming, key: "incomingTotal" as const },
    { id: "edit-outgoing", label: "Appels émis", icon: PhoneOutgoing, key: "outgoingTotal" as const },
    { id: "edit-handled", label: "Appels traités (Auto)", icon: CheckSquare, key: "handled" as const, disabled: true },
    { id: "edit-missed", label: "Appels manqués", icon: PhoneMissed, key: "missed" as const },
    { id: "edit-rdv", label: "Nombre de RDV", icon: ClipboardCheck, key: "rdvTotal" as const },
    { id: "edit-sms", label: "Messages envoyés", icon: MessageSquare, key: "smsTotal" as const },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-edit-title"
      onClick={() => !busy && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 id="report-edit-title" style={{ margin: 0 }}>Modifier le rapport</h3>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>
              Corrigez les chiffres saisis. Un rapport validé ne peut plus être modifié.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Calendar size={14} className="muted" />
            <span>{new Date(report.date).toLocaleDateString("fr-FR")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Target size={14} className="muted" />
            <span>{report.campaign.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <User size={14} className="muted" />
            <span>{report.user.name ?? report.user.email}</span>
          </div>
          <div>
            <span className={`badge ${report.status === "DRAFT" ? "badge-draft" : report.status === "SUBMITTED" ? "badge-submitted" : report.status === "VALIDATED" ? "badge-validated" : report.status === "REJECTED" ? "badge-rejected" : ""}`}>
              {statusLabel(report.status)}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {fields.map((item) => (
            <div className="field" style={{ minWidth: 0, marginBottom: 0 }} key={item.id}>
              <label className="label" htmlFor={item.id}>
                <item.icon size={14} style={{ marginRight: 6 }} />
                {item.label}
              </label>
              <input
                id={item.id}
                className="input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={item.disabled}
                style={item.disabled ? { background: "#f8fafc", cursor: "not-allowed", fontWeight: 700, color: "var(--primary)" } : {}}
                value={state[item.key]}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setState((p) => ({ ...p, [item.key]: val === "" ? 0 : parseInt(val, 10) }));
                }}
              />
            </div>
          ))}
        </div>

        <div className="field" style={{ marginTop: 20 }}>
          <label className="label" htmlFor="edit-observations">
            <MessageSquare size={14} style={{ marginRight: 6 }} />
            Observations
          </label>
          <textarea
            id="edit-observations"
            className="textarea"
            rows={3}
            value={state.observations}
            onChange={(e) => setState((p) => ({ ...p, observations: e.target.value }))}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>
            <Save size={18} />
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
          {canSubmit && (
            <button className="btn btn-primary" onClick={() => save(true)} disabled={busy} style={{ background: "var(--success)" }}>
              <Send size={18} />
              {busy ? "Soumission..." : "Enregistrer et soumettre"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
