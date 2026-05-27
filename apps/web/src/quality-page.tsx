import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Headphones,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Campaign, QualityEvaluation, QualityReferentialConfig } from "@crc/types";
import { useAuth } from "./auth";
import {
  deleteQualityEvaluation,
  getCampaignsLite,
  getQualityEvaluation,
  getQualityEvaluations,
  getQualityReferential,
  getUsersLite,
  saveQualityEvaluation,
  saveQualityReferential,
} from "./db";
import { ConfirmModal } from "./components/ConfirmModal";
import { useAsync } from "./hooks/useAsync";
import {
  QUALITY_CHANNELS,
  computeQualityResult,
  domainGroups,
  domainScore,
  emptyQualityScores,
  getDefaultReferential,
  rubricLabel,
  scoreOptions,
} from "./lib/quality-scoring";
import { QUALITY_GUIDE } from "./lib/quality-guide";
import { QualityPrintGrille, printQualityGrille } from "./lib/quality-print";
import { fmtDate, fmtPercent, statusBadge } from "./lib/quality-utils";

type Tab = "guide" | "referentiel" | "dashboard" | "liste" | "nouvelle" | "detail";

export function QualitePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("guide");
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
  const [formExternalCallId, setFormExternalCallId] = useState("");
  const [formAgentId, setFormAgentId] = useState("");
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formChannel, setFormChannel] = useState<string>(QUALITY_CHANNELS[0]);
  const [formScores, setFormScores] = useState(emptyQualityScores());
  const [formComments, setFormComments] = useState<Record<string, string>>({});
  const [formPositive, setFormPositive] = useState("");
  const [formActionPlan, setFormActionPlan] = useState("");
  const [formDebriefDate, setFormDebriefDate] = useState("");
  const [formDebriefConclusion, setFormDebriefConclusion] = useState("");

  const [referential, setReferential] = useState<QualityReferentialConfig>(getDefaultReferential());
  const [refDraft, setRefDraft] = useState<QualityReferentialConfig>(getDefaultReferential());
  const printRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => computeQualityResult(formScores, referential), [formScores, referential]);

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

  useEffect(() => {
    getQualityReferential()
      .then((cfg) => {
        const next = cfg || getDefaultReferential();
        setReferential(next);
        setRefDraft(structuredClone(next));
      })
      .catch(() => {
        const fallback = getDefaultReferential();
        setReferential(fallback);
        setRefDraft(structuredClone(fallback));
      });
  }, []);

  const resetForm = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormExternalCallId("");
    setFormAgentId("");
    setFormCampaignId("");
    setFormChannel(QUALITY_CHANNELS[0]);
    setFormScores(emptyQualityScores(referential));
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
      setFormExternalCallId(ev.externalCallId || "");
      setFormAgentId(ev.agent.id);
      setFormCampaignId(ev.campaign?.id || "");
      setFormChannel(ev.channel);
      setFormScores({ ...emptyQualityScores(referential), ...ev.scores });
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
      const result = computeQualityResult(formScores, referential);
      await saveQualityEvaluation({
        id: selectedId || undefined,
        evaluatedAt: formDate,
        agentUserId: formAgentId,
        evaluatorUserId: user.id,
        campaignId: formCampaignId || null,
        externalCallId: formExternalCallId.trim() || null,
        channel: formChannel,
        scores: formScores,
        totalPoints: result.totalPoints,
        finalScore: result.finalScore,
        finalPercent: result.finalPercent,
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
    if (!n) return { count: 0, avg: 0, avgPercent: 0, conformeRate: 0, coaching: 0, immediate: 0 };
    const avg = evaluations.reduce((s, e) => s + e.finalScore, 0) / n;
    const avgPct = evaluations.reduce((s, e) => s + (e.finalPercent ?? fmtPercent(e.finalScore)), 0) / n;
    const conforme = evaluations.filter((e) => e.conform).length;
    return {
      count: n,
      avg: Math.round(avg * 10) / 10,
      avgPercent: Math.round(avgPct * 10) / 10,
      conformeRate: Math.round((conforme / n) * 100),
      coaching: evaluations.filter((e) => e.coachingPriority).length,
      immediate: evaluations.filter((e) => e.immediateAction).length,
    };
  }, [evaluations]);

  const agentStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; sum: number; sumPct: number; conform: number; coaching: number; immediate: number }
    >();
    for (const ev of evaluations) {
      const id = ev.agent.id;
      const name = ev.agent.name || ev.agent.email;
      const cur = map.get(id) || { name, count: 0, sum: 0, sumPct: 0, conform: 0, coaching: 0, immediate: 0 };
      cur.count += 1;
      cur.sum += ev.finalScore;
      cur.sumPct += ev.finalPercent ?? fmtPercent(ev.finalScore);
      if (ev.conform) cur.conform += 1;
      if (ev.coachingPriority) cur.coaching += 1;
      if (ev.immediateAction) cur.immediate += 1;
      map.set(id, cur);
    }
    return Array.from(map.entries())
      .map(([id, s]) => ({
        id,
        name: s.name,
        count: s.count,
        avgScore: Math.round((s.sum / s.count) * 10) / 10,
        avgPercent: Math.round((s.sumPct / s.count) * 10) / 10,
        conformRate: Math.round((s.conform / s.count) * 100),
        coaching: s.coaching,
        immediate: s.immediate,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [evaluations]);

  const domainStats = useMemo(() => {
    return domainGroups(referential).map(({ domain, criteria }) => {
      const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
      let sum = 0;
      let count = 0;
      for (const ev of evaluations) {
        for (const c of criteria) {
          const v = ev.scores[c.id];
          if (typeof v === "number") sum += v;
        }
        count += 1;
      }
      const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
      return { domain, avg, max, percent: max ? Math.round((avg / max) * 1000) / 10 : 0 };
    });
  }, [evaluations, referential]);

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "guide", label: "Guide (Lisez-moi)", icon: BookOpen },
    { id: "referentiel", label: "Référentiel", icon: Settings },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "liste", label: "Écoutes", icon: ClipboardList },
    { id: "nouvelle", label: "Nouvelle écoute", icon: Plus },
  ];

  const selectedAgent = agents.find((a) => a.id === formAgentId);
  const selectedCampaign = campaigns.find((c) => c.id === formCampaignId);

  const handlePrint = () => {
    if (!printRef.current) return;
    printQualityGrille(printRef.current);
  };

  const handleSaveReferential = () =>
    run(async () => {
      if (!user?.id) throw new Error("Non authentifié");
      const saved = await saveQualityReferential(refDraft, user.id);
      setReferential(structuredClone(saved));
      setRefDraft(structuredClone(saved));
      toast.success("Référentiel enregistré");
    }).catch((err: any) => toast.error(err?.message || "Enregistrement impossible"));

  const thresholdFields: { key: keyof QualityReferentialConfig["thresholds"]; label: string }[] = [
    { key: "plafondMinusOne", label: "Plafond si -1" },
    { key: "plafondBlocking", label: "Plafond si bloquant < 2" },
    { key: "conformeMin", label: "Seuil conforme (min /20)" },
    { key: "coachingMax", label: "Seuil coaching (max /20)" },
    { key: "mentionExcellent", label: "Mention Excellent (min)" },
    { key: "mentionTresSatisfaisant", label: "Mention Très satisfaisant (min)" },
    { key: "mentionSatisfaisant", label: "Mention Satisfaisant (min)" },
    { key: "mentionAmeliorer", label: "Mention À améliorer (min)" },
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
              onClick={() => {
                if (t.id !== "nouvelle") setSelectedId(null);
                if (t.id === "nouvelle") {
                  resetForm();
                  setTab("nouvelle");
                } else {
                  setTab(t.id);
                }
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "guide" && (
        <div style={{ display: "grid", gap: 20, maxWidth: 820 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{QUALITY_GUIDE.title}</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>{QUALITY_GUIDE.intro}</p>
          </div>

          <div className="card">
            <h3>Parcours recommandé</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Équivalent de la feuille Excel <strong>0_LisezMoi</strong> — chaque étape correspond à une section de l'application.
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 16 }}>
              {QUALITY_GUIDE.parcours.map((p) => (
                <li key={p.step} style={{ lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700 }}>
                    {p.step}. {p.app}
                    <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                      (Excel : {p.excel})
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{p.description}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card">
            <h3>Règles automatiques (plafonnements)</h3>
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
              {QUALITY_GUIDE.plafonds.map((rule) => (
                <li key={rule} style={{ marginBottom: 8 }}>
                  {rule.split("**").map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Bonnes pratiques de notation</h3>
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
              {QUALITY_GUIDE.bonnesPratiques.map((tip) => (
                <li key={tip} style={{ marginBottom: 8 }}>
                  {tip.split("**").map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Mentions & statuts</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 12 }}>
              <div>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Mentions</h4>
                <table style={{ margin: 0, fontSize: 14 }}>
                  <tbody>
                    {QUALITY_GUIDE.mentions.map((m) => (
                      <tr key={m.label}>
                        <td style={{ fontWeight: 600, padding: "6px 12px 6px 0" }}>{m.label}</td>
                        <td className="muted">{m.seuil}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Statuts</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                  {QUALITY_GUIDE.statuts.map((s) => (
                    <li key={s.label} style={{ marginBottom: 10 }}>
                      <strong>{s.label}</strong>
                      <div className="muted" style={{ fontSize: 13 }}>{s.regle}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Personnalisation dans le CRM</h3>
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
              {QUALITY_GUIDE.personnalisation.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>
                  {item.split("**").map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => { resetForm(); setTab("nouvelle"); }}>
              <Plus size={18} />
              Commencer une écoute
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setTab("dashboard")}>
              <BarChart3 size={18} />
              Voir le dashboard
            </button>
          </div>
        </div>
      )}

      {tab === "referentiel" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Seuils & plafonds</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Équivalent feuille Excel <strong>1_Referentiel</strong> — seuils utilisés pour mentions, statuts et plafonnements.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {thresholdFields.map(({ key, label }) => (
                <div key={key} className="field" style={{ marginBottom: 0 }}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={20}
                    step={0.5}
                    value={refDraft.thresholds[key]}
                    onChange={(e) =>
                      setRefDraft((prev) => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, [key]: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {domainGroups(refDraft).map(({ domain, criteria }) => (
            <div key={domain} className="card">
              <h3>{domain}</h3>
              <div style={{ display: "grid", gap: 20, marginTop: 12 }}>
                {criteria.map((criterion) => (
                  <div key={criterion.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                      {criterion.name}
                      {criterion.blocking && (
                        <span className="badge" style={{ marginLeft: 8, background: "rgba(239,68,68,0.12)", color: "#b91c1c", fontSize: 10 }}>
                          BLOQUANT
                        </span>
                      )}
                      <span className="muted" style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>
                        Max {criterion.maxPoints} pts
                      </span>
                    </div>
                    <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{criterion.expected}</p>
                    <div style={{ display: "grid", gap: 8 }}>
                      {scoreOptions(criterion).map((score) => (
                        <div key={score} className="field" style={{ marginBottom: 0 }}>
                          <label className="label" style={{ fontSize: 12 }}>
                            Barème {score}
                          </label>
                          <textarea
                            className="input"
                            rows={2}
                            value={criterion.rubrics?.[String(score)] || ""}
                            onChange={(e) =>
                              setRefDraft((prev) => ({
                                ...prev,
                                criteria: prev.criteria.map((c) =>
                                  c.id === criterion.id
                                    ? { ...c, rubrics: { ...c.rubrics, [String(score)]: e.target.value } }
                                    : c,
                                ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy} onClick={handleSaveReferential}>
              <Save size={18} />
              {busy ? "Enregistrement..." : "Enregistrer le référentiel"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const def = getDefaultReferential();
                setRefDraft(def);
                toast.message("Référentiel par défaut rechargé (non enregistré)");
              }}
            >
              Réinitialiser (Excel)
            </button>
          </div>
        </div>
      )}

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
              { label: "Moyenne %", value: `${kpis.avgPercent}%` },
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
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>Statistiques globales par conseiller</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Chaque agent dispose de ses indicateurs agrégés sur la période filtrée (équivalent feuille 4_Dashboard).
            </p>
            {agentStats.length === 0 ? (
              <p className="muted">Aucune écoute sur la période.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ margin: 0, minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Conseiller</th>
                      <th style={{ textAlign: "right" }}>Écoutes</th>
                      <th style={{ textAlign: "right" }}>Moy. /20</th>
                      <th style={{ textAlign: "right" }}>Moy. %</th>
                      <th style={{ textAlign: "right" }}>Conformité</th>
                      <th style={{ textAlign: "right" }}>Coaching</th>
                      <th style={{ textAlign: "right" }}>Action imm.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ textAlign: "right" }}>{a.count}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{a.avgScore}</td>
                        <td style={{ textAlign: "right" }}>{a.avgPercent}%</td>
                        <td style={{ textAlign: "right" }}>{a.conformRate}%</td>
                        <td style={{ textAlign: "right" }}>{a.coaching}</td>
                        <td style={{ textAlign: "right" }}>{a.immediate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3>Performance par domaine</h3>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Domaine</th>
                  <th style={{ textAlign: "right" }}>Moyenne pts</th>
                  <th style={{ textAlign: "right" }}>Max</th>
                  <th style={{ textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {domainStats.map((d) => (
                  <tr key={d.domain}>
                    <td>{d.domain}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{d.avg}</td>
                    <td style={{ textAlign: "right" }} className="muted">{d.max}</td>
                    <td style={{ textAlign: "right" }}>{d.percent}%</td>
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
                  <th>ID appel</th>
                  <th>Conseiller</th>
                  <th>Campagne</th>
                  <th>Canal</th>
                  <th style={{ textAlign: "right" }}>Note /20</th>
                  <th style={{ textAlign: "right" }}>%</th>
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
                    <td className="muted" style={{ fontSize: 12, fontFamily: "monospace" }}>
                      {ev.externalCallId || "—"}
                    </td>
                    <td style={{ fontWeight: 600 }}>{ev.agent.name || ev.agent.email}</td>
                    <td>{ev.campaign?.name || "—"}</td>
                    <td>{ev.channel}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{ev.finalScore}</td>
                    <td style={{ textAlign: "right" }}>{ev.finalPercent ?? fmtPercent(ev.finalScore)}%</td>
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
            <h3 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Headphones size={20} />
              {tab === "detail" ? "Grille d'écoute" : "Nouvelle écoute"}
              {tab === "detail" && (
                <button type="button" className="btn btn-secondary" style={{ marginLeft: "auto", fontSize: 13 }} onClick={handlePrint}>
                  <Printer size={16} />
                  Imprimer la grille
                </button>
              )}
            </h3>
            <div className="responsive-filters" style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                <label className="label">ID appel Ubicentrex</label>
                <input
                  type="text"
                  className="input"
                  value={formExternalCallId}
                  onChange={(e) => setFormExternalCallId(e.target.value)}
                  placeholder="Copiez la référence de l'enregistrement depuis Ubicentrex"
                />
                <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  Permet de retrouver l&apos;appel écouté dans Ubicentrex après enregistrement.
                </p>
              </div>
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
                <div className="muted" style={{ fontSize: 12 }}>{computed.finalPercent}%</div>
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

          {domainGroups(referential).map(({ domain, criteria }) => {
            const ds = domainScore(formScores, criteria);
            return (
            <div key={domain} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0 }}>{domain}</h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  Sous-total {ds.points}/{ds.max} ({ds.percent}%)
                </span>
              </div>
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
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {scoreOptions(criterion).map((score) => (
                        <button
                          key={score}
                          type="button"
                          title={rubricLabel(criterion, score)}
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
                    {formScores[criterion.id] !== undefined && rubricLabel(criterion, formScores[criterion.id]) && (
                      <p className="muted" style={{ fontSize: 12, marginBottom: 8, fontStyle: "italic" }}>
                        {rubricLabel(criterion, formScores[criterion.id])}
                      </p>
                    )}
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" style={{ fontSize: 12 }}>Commentaire / verbatim</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={formComments[criterion.id] || ""}
                        onChange={(e) =>
                          setFormComments((prev) => ({ ...prev, [criterion.id]: e.target.value }))
                        }
                        placeholder="Observations spécifiques sur ce critère..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );})}

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

      {showForm && (
        <div ref={printRef} style={{ position: "absolute", left: -9999, top: 0 }}>
          <QualityPrintGrille
            config={referential}
            evaluatedAt={formDate}
            agentName={selectedAgent?.name || selectedAgent?.email || "—"}
            evaluatorName={user?.name || user?.email || "—"}
            campaignName={selectedCampaign?.name || ""}
            channel={formChannel}
            externalCallId={formExternalCallId.trim() || null}
            scores={formScores}
            comments={formComments}
            computed={computed}
            evaluationId={selectedId || undefined}
          />
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
