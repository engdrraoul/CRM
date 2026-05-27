import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  ClipboardList,
  Headphones,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Campaign, QualityEvaluation } from "@crc/types";
import { useAuth } from "./auth";
import {
  deleteQualityEvaluation,
  getCampaignsLite,
  getQualityEvaluation,
  getQualityEvaluations,
  getUsersLite,
  saveQualityEvaluation,
} from "./db";
import { ConfirmModal } from "./components/ConfirmModal";
import { useAsync } from "./hooks/useAsync";
import {
  QUALITY_CHANNELS,
  computeQualityResult,
  domainGroups,
  emptyQualityScores,
  scoreOptions,
} from "./lib/quality-scoring";

type Tab = "dashboard" | "liste" | "nouvelle" | "detail";

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR");
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    Conforme: { bg: "rgba(34,197,94,0.12)", color: "#15803d" },
    "Coaching prioritaire": { bg: "rgba(234,179,8,0.15)", color: "#a16207" },
    "Action immédiate": { bg: "rgba(239,68,68,0.12)", color: "#b91c1c" },
  };
  const s = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
      {status}
    </span>
  );
}

export function QualitePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [evaluations, setEvaluations] = useState<QualityEvaluation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, run] = useAsync();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QualityEvaluation | null>(null);

  const [filterAgent, setFilterAgent] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterEvaluator, setFilterEvaluator] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAgentId, setFormAgentId] = useState("");
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formChannel, setFormChannel] = useState<string>(QUALITY_CHANNELS[0]);
  const [formScores, setFormScores] = useState(emptyQualityScores());
  const [formComments, setFormComments] = useState<Record<string, string>>({});
  const [formPositive, setFormPositive] = useState("");
  const [formActionPlan, setFormActionPlan] = useState("");
  const [formDebriefDate, setFormDebriefDate] = useState("");
  const [formDebriefConclusion, setFormDebriefConclusion] = useState("");

  const computed = useMemo(() => computeQualityResult(formScores), [formScores]);

  const loadMeta = () => {
    getCampaignsLite().then(setCampaigns).catch(console.error);
    getUsersLite()
      .then((rows) => setAgents(rows.filter((u) => u.role === "TELECONSEILLER" || u.role === "SUPERVISEUR")))
      .catch(console.error);
  };

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const data = await getQualityEvaluations({
        ...(filterAgent ? { agentUserId: filterAgent } : {}),
        ...(filterCampaign ? { campaignId: filterCampaign } : {}),
        ...(filterEvaluator ? { evaluatorUserId: filterEvaluator } : {}),
        ...(filterFrom ? { dateFrom: filterFrom } : {}),
        ...(filterTo ? { dateTo: filterTo } : {}),
      });
      setEvaluations(data);
    } catch (err: any) {
      toast.error(err?.message || "Impossible de charger les écoutes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadEvaluations(); }, [filterAgent, filterCampaign, filterEvaluator, filterFrom, filterTo]);

  const resetForm = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAgentId("");
    setFormCampaignId("");
    setFormChannel(QUALITY_CHANNELS[0]);
    setFormScores(emptyQualityScores());
    setFormComments({});
    setFormPositive("");
    setFormActionPlan("");
    setFormDebriefDate("");
    setFormDebriefConclusion("");
    setSelectedId(null);
  };

  const openDetail = async (id: string) => {
    try {
      const ev = await getQualityEvaluation(id);
      setSelectedId(id);
      setFormDate(ev.evaluatedAt.slice(0, 10));
      setFormAgentId(ev.agent.id);
      setFormCampaignId(ev.campaign?.id || "");
      setFormChannel(ev.channel);
      setFormScores({ ...emptyQualityScores(), ...ev.scores });
      setFormComments(ev.comments || {});
      setFormPositive(ev.positivePoints || "");
      setFormActionPlan(ev.actionPlan || "");
      setFormDebriefDate(ev.debriefDate?.slice(0, 10) || "");
      setFormDebriefConclusion(ev.debriefConclusion || "");
      setTab("detail");
    } catch (err: any) {
      toast.error(err?.message || "Écoute introuvable");
    }
  };

  const handleSave = () =>
    run(async () => {
      if (!user?.id) throw new Error("Non authentifié");
      if (!formAgentId) throw new Error("Sélectionnez un conseiller");
      const result = computeQualityResult(formScores);
      await saveQualityEvaluation({
        id: selectedId || undefined,
        evaluatedAt: formDate,
        agentUserId: formAgentId,
        evaluatorUserId: user.id,
        campaignId: formCampaignId || null,
        channel: formChannel,
        scores: formScores,
        totalPoints: result.totalPoints,
        finalScore: result.finalScore,
        mention: result.mention,
        status: result.status,
        improvementAreas: result.improvementAreas,
        coachingPriority: result.coachingPriority,
        immediateAction: result.immediateAction,
        conform: result.conform,
        positivePoints: formPositive || null,
        actionPlan: formActionPlan || null,
        comments: formComments,
        debriefDate: formDebriefDate || null,
        debriefConclusion: formDebriefConclusion || null,
      });
      toast.success(selectedId ? "Écoute mise à jour" : "Écoute enregistrée");
      resetForm();
      setTab("liste");
      loadEvaluations();
    }).catch((err: any) => toast.error(err?.message || "Enregistrement impossible"));

  const kpis = useMemo(() => {
    const n = evaluations.length;
    if (!n) return { count: 0, avg: 0, conformeRate: 0, coaching: 0, immediate: 0 };
    const avg = evaluations.reduce((s, e) => s + e.finalScore, 0) / n;
    const conforme = evaluations.filter((e) => e.conform).length;
    return {
      count: n,
      avg: Math.round(avg * 10) / 10,
      conformeRate: Math.round((conforme / n) * 100),
      coaching: evaluations.filter((e) => e.coachingPriority).length,
      immediate: evaluations.filter((e) => e.immediateAction).length,
    };
  }, [evaluations]);

  const domainStats = useMemo(() => {
    return domainGroups().map(({ domain, criteria }) => {
      const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
      let sum = 0;
      let count = 0;
      for (const ev of evaluations) {
        for (const c of criteria) {
          const v = ev.scores[c.id];
          if (typeof v === "number") sum += v;
        }
        count++;
      }
      return { domain, avg: count ? Math.round((sum / count) * 10) / 10 : 0, max };
    });
  }, [evaluations]);

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "liste", label: "Écoutes", icon: ClipboardList },
    { id: "nouvelle", label: "Nouvelle écoute", icon: Plus },
  ];

  const showForm = tab === "nouvelle" || tab === "detail";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Qualité — Écoutes</h1>
          <p className="muted">Référentiel premium, scoring automatique et débrief conseiller</p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: 12, borderRadius: 12 }}>
          <ShieldCheck color="var(--primary)" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`btn ${tab === t.id || (t.id === "liste" && tab === "detail") ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { if (t.id !== "nouvelle") setSelectedId(null); setTab(t.id === "nouvelle" ? "nouvelle" : t.id); if (t.id === "nouvelle") resetForm(); }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {(tab === "dashboard" || tab === "liste") && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="responsive-filters">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Conseiller</label>
              <select className="select" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                <option value="">Tous</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name || a.email}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Campagne</label>
              <select className="select" value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)}>
                <option value="">Toutes</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Du</label>
              <input type="date" className="input" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Au</label>
              <input type="date" className="input" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={loadEvaluations} disabled={loading}>
              <Search size={16} />
              Actualiser
            </button>
          </div>
        </div>
      )}

      {tab === "dashboard" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Écoutes", value: kpis.count },
              { label: "Note moyenne /20", value: kpis.avg },
              { label: "Taux conformité", value: `${kpis.conformeRate}%` },
              { label: "Coaching prioritaire", value: kpis.coaching },
              { label: "Action immédiate", value: kpis.immediate },
            ].map((k) => (
              <div key={k.label} className="card" style={{ padding: "14px 16px" }}>
                <div className="muted" style={{ fontSize: 12 }}>{k.label}</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Performance par domaine</h3>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Domaine</th>
                  <th style={{ textAlign: "right" }}>Moyenne pts</th>
                  <th style={{ textAlign: "right" }}>Max</th>
                </tr>
              </thead>
              <tbody>
                {domainStats.map((d) => (
                  <tr key={d.domain}>
                    <td>{d.domain}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{d.avg}</td>
                    <td style={{ textAlign: "right" }} className="muted">{d.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "liste" && (
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          {loading ? (
            <p style={{ padding: 24, textAlign: "center" }} className="muted">Chargement...</p>
          ) : evaluations.length === 0 ? (
            <p style={{ padding: 24, textAlign: "center" }} className="muted">Aucune écoute sur la période.</p>
          ) : (
            <table style={{ margin: 0, minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Conseiller</th>
                  <th>Campagne</th>
                  <th>Canal</th>
                  <th style={{ textAlign: "right" }}>Note /20</th>
                  <th>Mention</th>
                  <th>Statut</th>
                  <th>Évaluateur</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td>{fmtDate(ev.evaluatedAt.slice(0, 10))}</td>
                    <td style={{ fontWeight: 600 }}>{ev.agent.name || ev.agent.email}</td>
                    <td>{ev.campaign?.name || "—"}</td>
                    <td>{ev.channel}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{ev.finalScore}</td>
                    <td>{ev.mention}</td>
                    <td>{statusBadge(ev.status)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{ev.evaluator.name || ev.evaluator.email}</td>
                    <td>
                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openDetail(ev.id)}>
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Headphones size={20} />
              {tab === "detail" ? "Grille d'écoute" : "Nouvelle écoute"}
            </h3>
            <div className="responsive-filters" style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Date de l'écoute</label>
                <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Conseiller *</label>
                <select className="select" value={formAgentId} onChange={(e) => setFormAgentId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Campagne / Projet</label>
                <select className="select" value={formCampaignId} onChange={(e) => setFormCampaignId(e.target.value)}>
                  <option value="">— Optionnel —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Canal</label>
                <select className="select" value={formChannel} onChange={(e) => setFormChannel(e.target.value)}>
                  {QUALITY_CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
              <div className="card" style={{ padding: 12, background: "#f8fafc" }}>
                <div className="muted" style={{ fontSize: 11 }}>Total brut</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{computed.totalPoints}/20</div>
              </div>
              <div className="card" style={{ padding: 12, background: computed.immediateAction ? "rgba(239,68,68,0.08)" : "#f8fafc" }}>
                <div className="muted" style={{ fontSize: 11 }}>Note finale</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{computed.finalScore}/20</div>
              </div>
              <div className="card" style={{ padding: 12, background: "#f8fafc" }}>
                <div className="muted" style={{ fontSize: 11 }}>Mention</div>
                <div style={{ fontWeight: 700 }}>{computed.mention}</div>
              </div>
              <div className="card" style={{ padding: 12, background: "#f8fafc" }}>
                <div className="muted" style={{ fontSize: 11 }}>Statut</div>
                <div>{statusBadge(computed.status)}</div>
              </div>
            </div>
            {(computed.hasMinusOne || computed.blockingFail) && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>
                {computed.hasMinusOne && "Plafond appliqué : critère noté -1 (max 8/20). "}
                {computed.blockingFail && "Plafond appliqué : critère bloquant &lt; 2 (max 12/20)."}
              </p>
            )}
          </div>

          {domainGroups().map(({ domain, criteria }) => (
            <div key={domain} className="card">
              <h3>{domain}</h3>
              <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
                {criteria.map((criterion) => (
                  <div key={criterion.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {criterion.name}
                          {criterion.blocking && (
                            <span className="badge" style={{ marginLeft: 8, background: "rgba(239,68,68,0.12)", color: "#b91c1c", fontSize: 10 }}>
                              BLOQUANT
                            </span>
                          )}
                        </div>
                        <p className="muted" style={{ fontSize: 12, marginTop: 4, maxWidth: 720 }}>{criterion.expected}</p>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Max {criterion.maxPoints} pts</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {scoreOptions(criterion).map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setFormScores((prev) => ({ ...prev, [criterion.id]: score }))}
                          style={{
                            minWidth: 40,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid",
                            borderColor: formScores[criterion.id] === score ? "var(--primary)" : "#cbd5e1",
                            background: formScores[criterion.id] === score ? "rgba(37,99,235,0.1)" : "#fff",
                            fontWeight: formScores[criterion.id] === score ? 700 : 400,
                            cursor: "pointer",
                            color: score === -1 ? "#b91c1c" : undefined,
                          }}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {computed.improvementAreas && (
            <div className="card">
              <h3>Axes d'amélioration (auto)</h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{computed.improvementAreas}</p>
            </div>
          )}

          <div className="card">
            <h3>Plan d'action & débrief</h3>
            <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
              <div className="field">
                <label className="label">Points forts observés</label>
                <textarea className="input" rows={3} value={formPositive} onChange={(e) => setFormPositive(e.target.value)} placeholder="Ex : conseiller posé, courtois..." />
              </div>
              <div className="field">
                <label className="label">Plan d'action</label>
                <textarea className="input" rows={3} value={formActionPlan} onChange={(e) => setFormActionPlan(e.target.value)} placeholder="Écoutes, débriefings, formation..." />
              </div>
              <div className="responsive-filters">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Date du débrief</label>
                  <input type="date" className="input" value={formDebriefDate} onChange={(e) => setFormDebriefDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="label">Conclusion managériale</label>
                <textarea className="input" rows={3} value={formDebriefConclusion} onChange={(e) => setFormDebriefConclusion(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy || !formAgentId} onClick={handleSave}>
              <Save size={18} />
              {busy ? "Enregistrement..." : "Enregistrer l'écoute"}
            </button>
            {selectedId && (
              <button type="button" className="btn btn-danger" onClick={() => {
                const ev = evaluations.find((e) => e.id === selectedId);
                if (ev) setToDelete(ev);
              }}>
                <Trash2 size={18} />
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer cette écoute ?"
        message={toDelete ? `Écoute du ${fmtDate(toDelete.evaluatedAt.slice(0, 10))} — ${toDelete.agent.name || toDelete.agent.email}` : ""}
        confirmLabel="Supprimer"
        variant="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          run(async () => {
            if (!toDelete) return;
            await deleteQualityEvaluation(toDelete.id);
            toast.success("Écoute supprimée");
            setToDelete(null);
            if (selectedId === toDelete.id) { resetForm(); setTab("liste"); }
            loadEvaluations();
          }).catch((err: any) => toast.error(err?.message || "Suppression impossible"))
        }
      />
    </div>
  );
}
