import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  Headphones,
  Plus,
  Save,
  Calendar,
  Filter,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Target,
  UserCircle,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileDown,
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
  purgeQualityTestData,
  QUALITY_TEST_CALL_PREFIX,
  saveQualityEvaluation,
  saveQualityReferential,
  seedQualityTestData,
} from "./db";
import { ConfirmModal } from "./components/ConfirmModal";
import { useAsync } from "./hooks/useAsync";
import {
  QUALITY_CHANNELS,
  computeQualityResult,
  domainGroups,
  emptyQualityScores,
  getDefaultReferential,
  scoreOptions,
} from "./lib/quality-scoring";
import { QUALITY_GUIDE } from "./lib/quality-guide";
import { QualityPrintGrille, printQualityGrille } from "./lib/quality-print";
import { QualityIndividualExport, buildIndividualPdfFilename } from "./lib/quality-individual-export";
import { QualityGroupExport, buildGroupPdfFilename } from "./lib/quality-group-export";
import { buildHistoryPdfFilename, downloadSectionsAsPdf } from "./lib/quality-pdf";
import {
  agentKpisFromEvaluations,
  buildAgentChartData,
  buildAgentDailyStats,
  buildDailyStats,
  buildDomainChartData,
  filterEvaluationsForAgent,
  groupEvaluationsByAgent,
} from "./lib/quality-analytics";
import { QualityChartsGrid } from "./components/quality/QualityCharts";
import { buildActionPlanSuggestion, buildDebriefConclusion } from "./lib/quality-debrief";
import { logQuality, logQualityError } from "./lib/quality-log";
import { QualityFormWizard, type FormMode, type FormStep } from "./components/quality/QualityFormWizard";
import { fmtDate, fmtPercent, avgRdvCriterion, rdvCriterionPercent, rdvCriterionScore, CRITERION_EXACTITUDE, CRITERION_PROCEDURE, CRITERION_RDV_MAX, statusBadge } from "./lib/quality-utils";
import "./quality-page.css";

type Tab = "guide" | "referentiel" | "dashboard" | "liste" | "nouvelle" | "detail";

type PersonLite = { id: string; name: string | null; email: string };

function displayName(p: { name: string | null; email: string }) {
  return p.name?.trim() || p.email;
}

function initials(p: { name: string | null; email: string }) {
  const n = p.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return p.email.slice(0, 2).toUpperCase();
}

export function QualitePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("liste");
  const [evaluations, setEvaluations] = useState<QualityEvaluation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<PersonLite[]>([]);
  const [evaluators, setEvaluators] = useState<PersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, run] = useAsync();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QualityEvaluation | null>(null);
  const [detailEvaluator, setDetailEvaluator] = useState<PersonLite | null>(null);

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

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formStep, setFormStep] = useState<FormStep>(1);
  const [originalEvaluatorId, setOriginalEvaluatorId] = useState<string | null>(null);
  const [renotePreviousScore, setRenotePreviousScore] = useState<number | null>(null);
  const [actionPlanTouched, setActionPlanTouched] = useState(false);
  const [debriefConclusionTouched, setDebriefConclusionTouched] = useState(false);

  const [historyView, setHistoryView] = useState<"list" | "cards">("list");
  const [testPanelOpen, setTestPanelOpen] = useState(false);

  const [referential, setReferential] = useState<QualityReferentialConfig>(getDefaultReferential());
  const [refDraft, setRefDraft] = useState<QualityReferentialConfig>(getDefaultReferential());
  const printDialogRef = useRef<HTMLDivElement>(null);
  const individualPdfRef = useRef<HTMLDivElement>(null);
  const pdfSingleRef = useRef<HTMLDivElement>(null);
  const groupExportRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfSingleEv, setPdfSingleEv] = useState<QualityEvaluation | null>(null);
  const [periodExportMode, setPeriodExportMode] = useState<"liste" | "dashboard" | { type: "agent"; agentId: string } | null>(null);

  const computed = useMemo(() => computeQualityResult(formScores, referential), [formScores, referential]);

  const coachDisplay = user ? displayName(user) : "—";
  const evaluatorForDisplay = detailEvaluator ?? (user ? { id: user.id, name: user.name, email: user.email } : null);
  const evaluatorLabel = evaluatorForDisplay ? displayName(evaluatorForDisplay) : "—";

  const loadMeta = () => {
    getCampaignsLite().then(setCampaigns).catch(console.error);
    getUsersLite()
      .then((rows) => {
        setAgents(rows.filter((u) => u.role === "TELECONSEILLER" || u.role === "SUPERVISEUR"));
        setEvaluators(rows.filter((u) => u.role === "COACH_QUALITE" || u.role === "ADMIN"));
      })
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
    setDetailEvaluator(null);
    setFormMode("create");
    setFormStep(1);
    setOriginalEvaluatorId(null);
    setRenotePreviousScore(null);
    setActionPlanTouched(false);
    setDebriefConclusionTouched(false);
  };

  const populateFormFromEvaluation = (ev: QualityEvaluation, mode: FormMode, step: FormStep) => {
    setSelectedId(ev.id);
    setOriginalEvaluatorId(ev.evaluator.id);
    setDetailEvaluator({ id: ev.evaluator.id, name: ev.evaluator.name, email: ev.evaluator.email });
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
    setActionPlanTouched(!!ev.actionPlan?.trim());
    setDebriefConclusionTouched(!!ev.debriefConclusion?.trim());
    setFormMode(mode);
    setFormStep(step);
    setRenotePreviousScore(mode === "renote" ? ev.finalScore : null);
    if (mode === "renote" && !ev.debriefDate) {
      setFormDebriefDate(new Date().toISOString().slice(0, 10));
    }
    logQuality("form_open", { mode, evaluationId: ev.id, agentId: ev.agent.id, step });
  };

  const startNewEvaluation = () => {
    resetForm();
    setTab("nouvelle");
    logQuality("form_open", { mode: "create", step: 1 });
  };

  const openDetail = async (id: string) => {
    try {
      const ev = await getQualityEvaluation(id);
      populateFormFromEvaluation(ev, "edit", 1);
      setTab("detail");
    } catch (err: any) {
      toast.error(err?.message || "Écoute introuvable");
    }
  };

  const openRenote = async (id: string) => {
    try {
      const ev = await getQualityEvaluation(id);
      populateFormFromEvaluation(ev, "renote", 2);
      setTab("detail");
    } catch (err: any) {
      toast.error(err?.message || "Écoute introuvable");
    }
  };

  const applyDebriefAuto = (force: boolean) => {
    const agent = agents.find((a) => a.id === formAgentId);
    const agentName = agent ? displayName(agent) : "le conseiller";
    const result = computeQualityResult(formScores, referential);
    const debriefDate = formDebriefDate || new Date().toISOString().slice(0, 10);
    if (!formDebriefDate) setFormDebriefDate(debriefDate);

    let nextPlan = formActionPlan;
    if (force || !actionPlanTouched) {
      nextPlan = buildActionPlanSuggestion(result);
      setFormActionPlan(nextPlan);
      logQuality("debrief_auto_fill", { field: "actionPlan", manual: force, length: nextPlan.length });
    }

    if (force || !debriefConclusionTouched) {
      const conclusion = buildDebriefConclusion({
        agentName,
        computed: result,
        actionPlan: nextPlan,
        positivePoints: formPositive,
        debriefDate,
      });
      setFormDebriefConclusion(conclusion);
      logQuality("debrief_auto_fill", { field: "conclusion", manual: force, length: conclusion.length });
    }
  };

  const regenerateActionPlan = () => {
    const result = computeQualityResult(formScores, referential);
    const plan = buildActionPlanSuggestion(result);
    setFormActionPlan(plan);
    setActionPlanTouched(false);
    logQuality("debrief_auto_fill", { field: "actionPlan", manual: true, length: plan.length });
  };

  const regenerateConclusion = () => {
    const agent = agents.find((a) => a.id === formAgentId);
    const agentName = agent ? displayName(agent) : "le conseiller";
    const result = computeQualityResult(formScores, referential);
    const debriefDate = formDebriefDate || new Date().toISOString().slice(0, 10);
    const conclusion = buildDebriefConclusion({
      agentName,
      computed: result,
      actionPlan: formActionPlan,
      positivePoints: formPositive,
      debriefDate,
    });
    setFormDebriefConclusion(conclusion);
    setDebriefConclusionTouched(false);
    logQuality("debrief_auto_fill", { field: "conclusion", manual: true, length: conclusion.length });
  };

  const goToStep = (next: FormStep) => {
    logQuality("step_change", { from: formStep, to: next });
    setFormStep(next);
    if (next === 3) applyDebriefAuto(false);
  };

  const handleScoreChange = (criterionId: string, score: number) => {
    setFormScores((prev) => {
      const old = prev[criterionId];
      if (old !== score) logQuality("score_change", { criterionId, from: old, to: score });
      return { ...prev, [criterionId]: score };
    });
  };

  const handleSave = () =>
    run(async () => {
      const t0 = performance.now();
      if (!user?.id) throw new Error("Non authentifié");
      if (!formAgentId) throw new Error("Sélectionnez un conseiller");
      const result = computeQualityResult(formScores, referential);
      const evaluatorId = selectedId && originalEvaluatorId ? originalEvaluatorId : user.id;
      const saveEvent = !selectedId ? "save_create" : formMode === "renote" ? "save_renote" : "save_update";
      try {
        await saveQualityEvaluation({
          id: selectedId || undefined,
          evaluatedAt: formDate,
          agentUserId: formAgentId,
          evaluatorUserId: evaluatorId,
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
        logQuality(saveEvent, {
          evaluationId: selectedId,
          finalScore: result.finalScore,
          status: result.status,
          durationMs: Math.round(performance.now() - t0),
        });
        toast.success(
          formMode === "renote"
            ? "Re-notation enregistrée"
            : selectedId
              ? "Écoute mise à jour"
              : "Écoute enregistrée",
        );
        resetForm();
        setTab("liste");
        loadEvaluations();
      } catch (err) {
        logQualityError("save_error", err, { saveEvent, evaluationId: selectedId });
        throw err;
      }
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
      const name = displayName(ev.agent);
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

  const keyScorePeriod = useMemo(
    () => ({
      exactitude: avgRdvCriterion(evaluations, CRITERION_EXACTITUDE),
      procedure: avgRdvCriterion(evaluations, CRITERION_PROCEDURE),
    }),
    [evaluations],
  );

  const dailyStats = useMemo(() => buildDailyStats(evaluations), [evaluations]);

  const agentDailyStats = useMemo(
    () => buildAgentDailyStats(evaluations, (agent) => displayName(agent)),
    [evaluations],
  );

  const historyAgentGroups = useMemo(
    () => groupEvaluationsByAgent(evaluations, (agent) => displayName(agent)),
    [evaluations],
  );

  const agentChartData = useMemo(() => buildAgentChartData(agentStats), [agentStats]);
  const domainChartData = useMemo(() => buildDomainChartData(domainStats), [domainStats]);

  const periodExportEvaluations = useMemo(() => {
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return filterEvaluationsForAgent(evaluations, periodExportMode.agentId);
    }
    return evaluations;
  }, [evaluations, periodExportMode]);

  const periodExportAgentStats = useMemo(() => {
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return agentStats.filter((a) => a.id === periodExportMode.agentId);
    }
    return agentStats;
  }, [agentStats, periodExportMode]);

  const periodExportAgentDaily = useMemo(() => {
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return agentDailyStats.filter((r) => r.agentId === periodExportMode.agentId);
    }
    return agentDailyStats;
  }, [agentDailyStats, periodExportMode]);

  const periodExportDaily = useMemo(() => {
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return buildDailyStats(periodExportEvaluations);
    }
    return dailyStats;
  }, [dailyStats, periodExportEvaluations, periodExportMode]);

  const periodExportKpis = useMemo(() => {
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return agentKpisFromEvaluations(periodExportEvaluations);
    }
    return kpis;
  }, [kpis, periodExportEvaluations, periodExportMode]);

  const periodExportDomainStats = useMemo(() => {
    if (!periodExportEvaluations.length) return domainStats;
    if (periodExportMode && typeof periodExportMode === "object" && periodExportMode.type === "agent") {
      return domainGroups(referential).map(({ domain, criteria }) => {
        const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
        let sum = 0;
        const count = periodExportEvaluations.length;
        for (const ev of periodExportEvaluations) {
          for (const c of criteria) {
            const v = ev.scores[c.id];
            if (typeof v === "number") sum += v;
          }
        }
        const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
        return { domain, avg, max, percent: max ? Math.round((avg / max) * 1000) / 10 : 0 };
      });
    }
    return domainStats;
  }, [domainStats, periodExportEvaluations, periodExportMode, referential]);

  const periodExportDomainChart = useMemo(
    () => buildDomainChartData(periodExportDomainStats),
    [periodExportDomainStats],
  );

  const periodExportAgentChart = useMemo(
    () => buildAgentChartData(periodExportAgentStats),
    [periodExportAgentStats],
  );

  const periodExportAgentGroups = useMemo(
    () => groupEvaluationsByAgent(periodExportEvaluations, (agent) => displayName(agent)),
    [periodExportEvaluations],
  );

  const periodExportKeyScores = useMemo(
    () => ({
      exactitude: avgRdvCriterion(periodExportEvaluations, CRITERION_EXACTITUDE)?.pct ?? null,
      procedure: avgRdvCriterion(periodExportEvaluations, CRITERION_PROCEDURE)?.pct ?? null,
    }),
    [periodExportEvaluations],
  );

  const pdfGeneratedAt = fmtDate(new Date().toISOString().slice(0, 10));

  const filteredAgent = filterAgent ? agents.find((a) => a.id === filterAgent) : null;

  const periodLabel = useMemo(() => {
    if (filterFrom && filterTo) return `du ${fmtDate(filterFrom)} au ${fmtDate(filterTo)}`;
    if (filterFrom) return `depuis le ${fmtDate(filterFrom)}`;
    if (filterTo) return `jusqu'au ${fmtDate(filterTo)}`;
    return "toutes périodes";
  }, [filterFrom, filterTo]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filteredAgent) parts.push(`Conseiller : ${displayName(filteredAgent)}`);
    if (filterCampaign) {
      const name = campaigns.find((c) => c.id === filterCampaign)?.name;
      if (name) parts.push(`Campagne : ${name}`);
    }
    if (filterEvaluator) {
      const ev = evaluators.find((e) => e.id === filterEvaluator);
      if (ev) parts.push(`Coach : ${displayName(ev)}`);
    }
    return parts.join(" · ");
  }, [filteredAgent, filterCampaign, filterEvaluator, campaigns, evaluators]);

  const groupExportProps = useMemo(() => {
    if (!periodExportMode) return null;
    const isAgent = typeof periodExportMode === "object" && periodExportMode.type === "agent";
    const mode =
      periodExportMode === "liste" ? "history" as const : isAgent ? "agent" as const : "pilotage" as const;
    const title =
      mode === "history"
        ? "Historique des écoutes qualité"
        : mode === "agent"
          ? periodExportAgentStats[0]?.name ?? "Conseiller"
          : "Rapport de pilotage qualité";
    return {
      mode,
      title,
      periodLabel,
      filterSummary,
      generatedAt: pdfGeneratedAt,
      kpis: periodExportMode === "liste" ? kpis : periodExportKpis,
      keyScorePeriod:
        periodExportMode === "liste"
          ? {
              exactitude: keyScorePeriod.exactitude?.pct ?? null,
              procedure: keyScorePeriod.procedure?.pct ?? null,
            }
          : periodExportKeyScores,
      agentStats: periodExportMode === "liste" ? agentStats : periodExportAgentStats,
      agentDailyStats: periodExportMode === "liste" ? agentDailyStats : periodExportAgentDaily,
      agentGroups: periodExportMode === "liste" ? historyAgentGroups : periodExportAgentGroups,
      domainStats: periodExportDomainStats,
      dailyStats: periodExportMode === "liste" ? dailyStats : periodExportDaily,
    };
  }, [
    periodExportMode,
    periodExportAgentStats,
    periodLabel,
    filterSummary,
    pdfGeneratedAt,
    kpis,
    periodExportKpis,
    keyScorePeriod,
    periodExportKeyScores,
    agentStats,
    periodExportAgentStats,
    agentDailyStats,
    periodExportAgentDaily,
    historyAgentGroups,
    periodExportAgentGroups,
    periodExportDomainStats,
    dailyStats,
    periodExportDaily,
  ]);

  const slugForFilename = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "export";

  const waitForPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const waitForCharts = () => new Promise<void>((resolve) => window.setTimeout(resolve, 500));

  const handlePrint = () => {
    if (!printDialogRef.current) return;
    printQualityGrille(printDialogRef.current);
  };

  const handleExportGrillePdf = async () => {
    if (!individualPdfRef.current) return;
    setExportingPdf(true);
    const tId = toast.loading("Génération du rapport…");
    try {
      await waitForPaint();
      const agentName = selectedAgent ? displayName(selectedAgent) : "ecoute";
      await downloadSectionsAsPdf(
        individualPdfRef.current,
        buildIndividualPdfFilename(agentName, formDate),
      );
      logQuality("export_pdf", { type: "grille", evaluationId: selectedId });
      toast.success("Rapport PDF téléchargé", { id: tId });
    } catch (err) {
      logQualityError("export_pdf_error", err, { type: "grille", evaluationId: selectedId });
      toast.error("Export PDF impossible", { id: tId });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportEvaluationPdf = async (ev: QualityEvaluation) => {
    setExportingPdf(true);
    const tId = toast.loading("Génération du rapport…");
    try {
      flushSync(() => setPdfSingleEv(ev));
      await waitForPaint();
      if (!pdfSingleRef.current?.querySelector("[data-pdf-section]")) {
        throw new Error("Contenu PDF indisponible");
      }
      const agentName = displayName(ev.agent);
      const date = ev.evaluatedAt.slice(0, 10);
      await downloadSectionsAsPdf(pdfSingleRef.current, buildIndividualPdfFilename(agentName, date));
      logQuality("export_pdf", { type: "grille", evaluationId: ev.id });
      toast.success("Rapport PDF téléchargé", { id: tId });
    } catch (err) {
      logQualityError("export_pdf_error", err, { type: "grille", evaluationId: ev.id });
      toast.error("Export PDF impossible", { id: tId });
    } finally {
      setPdfSingleEv(null);
      setExportingPdf(false);
    }
  };

  const handleExportHistoryPdf = async () => {
    if (!evaluations.length) {
      toast.error("Aucune écoute à exporter");
      return;
    }
    setExportingPdf(true);
    const tId = toast.loading("Génération du PDF historique…");
    try {
      flushSync(() => setPeriodExportMode("liste"));
      await waitForPaint();
      await waitForCharts();
      const node = groupExportRef.current;
      if (!node?.querySelector("[data-pdf-section]")) {
        throw new Error("Contenu PDF indisponible — réessayez");
      }
      await downloadSectionsAsPdf(node, buildHistoryPdfFilename(filterFrom, filterTo));
      logQuality("export_pdf", { type: "liste", count: evaluations.length });
      toast.success("PDF historique téléchargé", { id: tId });
    } catch (err) {
      logQualityError("export_pdf_error", err, { type: "liste", count: evaluations.length });
      toast.error("Export PDF impossible", { id: tId });
    } finally {
      setPeriodExportMode(null);
      setExportingPdf(false);
    }
  };

  const handleExportPeriodPdf = async (mode: "liste" | "dashboard") => {
    if (mode === "liste") {
      await handleExportHistoryPdf();
      return;
    }
    setExportingPdf(true);
    const tId = toast.loading("Génération du PDF…");
    try {
      flushSync(() => setPeriodExportMode(mode));
      await waitForPaint();
      await waitForCharts();
      if (!groupExportRef.current?.querySelector("[data-pdf-section]")) {
        throw new Error("Conteneur PDF indisponible");
      }
      await downloadSectionsAsPdf(
        groupExportRef.current,
        buildGroupPdfFilename("pilotage", "pilotage", filterFrom, filterTo),
      );
      logQuality("export_pdf", { type: mode, count: evaluations.length });
      toast.success("PDF téléchargé", { id: tId });
    } catch (err) {
      logQualityError("export_pdf_error", err, { type: mode, count: evaluations.length });
      toast.error("Export PDF impossible", { id: tId });
    } finally {
      setPeriodExportMode(null);
      setExportingPdf(false);
    }
  };

  const handleExportAgentPdf = async (agentId: string, agentName: string) => {
    setExportingPdf(true);
    const tId = toast.loading("Génération du PDF…");
    try {
      flushSync(() => setPeriodExportMode({ type: "agent", agentId }));
      await waitForPaint();
      await waitForCharts();
      if (!groupExportRef.current?.querySelector("[data-pdf-section]")) {
        throw new Error("Conteneur PDF indisponible");
      }
      await downloadSectionsAsPdf(
        groupExportRef.current,
        buildGroupPdfFilename("agent", agentName, filterFrom, filterTo),
      );
      logQuality("export_pdf", { type: "agent", agentId, count: filterEvaluationsForAgent(evaluations, agentId).length });
      toast.success("PDF téléchargé", { id: tId });
    } catch (err) {
      logQualityError("export_pdf_error", err, { type: "agent", agentId });
      toast.error("Export PDF impossible", { id: tId });
    } finally {
      setPeriodExportMode(null);
      setExportingPdf(false);
    }
  };

  const periodScoreBlock = evaluations.length > 0 && (tab === "liste" || tab === "dashboard") && (
    <div className="quality-metrics-strip">
      <div className="quality-metrics-context">
        <span className="quality-metrics-title">
          {filteredAgent ? displayName(filteredAgent) : "Tous les conseillers"}
        </span>
        <span className="quality-metrics-sub">
          {periodLabel} · {kpis.count} écoute{kpis.count > 1 ? "s" : ""}
          {filterCampaign && <> · {campaigns.find((c) => c.id === filterCampaign)?.name}</>}
        </span>
      </div>
      <div className="quality-metrics-row">
        <div className="quality-metric">
          <span className="quality-metric-label">Score écoute</span>
          <span className="quality-metric-value">{kpis.avg}<small>/20</small></span>
          <span className="quality-metric-sub">{kpis.avgPercent}%</span>
        </div>
        <span className="quality-metric-divider" aria-hidden />
        <div className="quality-metric">
          <span className="quality-metric-label">Exactitude</span>
          <span className="quality-metric-value">
            {keyScorePeriod.exactitude ? <>{keyScorePeriod.exactitude.avg}<small>/{CRITERION_RDV_MAX}</small></> : "—"}
          </span>
          {keyScorePeriod.exactitude && (
            <span className="quality-metric-sub">{keyScorePeriod.exactitude.pct}%</span>
          )}
        </div>
        <span className="quality-metric-divider" aria-hidden />
        <div className="quality-metric">
          <span className="quality-metric-label">Procédure</span>
          <span className="quality-metric-value">
            {keyScorePeriod.procedure ? <>{keyScorePeriod.procedure.avg}<small>/{CRITERION_RDV_MAX}</small></> : "—"}
          </span>
          {keyScorePeriod.procedure && (
            <span className="quality-metric-sub">{keyScorePeriod.procedure.pct}%</span>
          )}
        </div>
        <span className="quality-metric-divider" aria-hidden />
        <div className="quality-metric">
          <span className="quality-metric-label">Conformité</span>
          <span className="quality-metric-value">{kpis.conformeRate}<small>%</small></span>
        </div>
        <span className="quality-metric-divider" aria-hidden />
        <div className="quality-metric quality-metric-compact">
          <span className="quality-metric-label">Coaching · Action imm.</span>
          <span className="quality-metric-value">{kpis.coaching} · {kpis.immediate}</span>
        </div>
      </div>
    </div>
  );

  const primaryTabs: { id: Tab; label: string; icon: typeof Plus; cta?: boolean }[] = [
    { id: "nouvelle", label: "Nouvelle écoute", icon: Plus, cta: true },
    { id: "liste", label: "Historique", icon: ClipboardList },
    { id: "dashboard", label: "Pilotage", icon: BarChart3 },
  ];

  const secondaryTabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "referentiel", label: "Référentiel", icon: Settings },
  ];

  const selectedAgent = agents.find((a) => a.id === formAgentId);
  const selectedCampaign = campaigns.find((c) => c.id === formCampaignId);

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
  const isActiveTab = (id: Tab) => tab === id || (id === "liste" && tab === "detail");

  const hasActiveFilters = !!(filterAgent || filterCampaign || filterEvaluator || filterFrom || filterTo);

  const testEvaluationCount = useMemo(
    () => evaluations.filter((e) => e.externalCallId?.startsWith(QUALITY_TEST_CALL_PREFIX)).length,
    [evaluations],
  );

  const handleLoadTestData = () =>
    run(async () => {
      const n = await seedQualityTestData(user!.id);
      logQuality("seed_test", { count: n });
      toast.success(`${n} écoutes test créées — ouvrez l'onglet Historique`);
      await loadEvaluations();
    }).catch((err: any) => toast.error(err?.message || "Seed impossible"));

  const handlePurgeTestData = () =>
    run(async () => {
      const n = await purgeQualityTestData();
      logQuality("purge_test", { count: n });
      toast.success(n ? `${n} écoutes test supprimées` : "Aucune donnée test à supprimer");
      await loadEvaluations();
    }).catch((err: any) => toast.error(err?.message || "Purge impossible"));

  const testDataPanel = (tab === "dashboard" || tab === "liste") && (
    <div className="quality-test-line">
      <button
        type="button"
        className="quality-test-line-toggle"
        onClick={() => setTestPanelOpen((v) => !v)}
      >
        {testPanelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Données de démo
        <span className="quality-test-line-count">
          {testEvaluationCount > 0 ? `${testEvaluationCount} chargée(s)` : "aucune"}
        </span>
      </button>
      {testPanelOpen && (
        <div className="quality-test-line-body">
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            Chargez 6 écoutes fictives (badge <code>TEST</code>), consultez-les dans Historique, puis supprimez-les.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !user?.id} onClick={handleLoadTestData}>
              Charger 6 écoutes test
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={handlePurgeTestData}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const resetFilters = () => {
    setFilterAgent("");
    setFilterCampaign("");
    setFilterEvaluator("");
    setFilterFrom("");
    setFilterTo("");
  };

  const filtersBlock = (
    <div className="quality-filters-bar">
      <div className="quality-filters-row">
        <div className="field quality-filter-field">
          <label className="label" htmlFor="q-filter-agent">
            <UserCircle size={14} />
            Conseiller
          </label>
            <select
              id="q-filter-agent"
              className="select"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
            >
              <option value="">Tous les conseillers</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{displayName(a)}</option>
              ))}
            </select>
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-campaign">
              <Target size={14} />
              Campagne
            </label>
            <select
              id="q-filter-campaign"
              className="select"
              value={filterCampaign}
              onChange={(e) => setFilterCampaign(e.target.value)}
            >
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-evaluator">
              <ShieldCheck size={14} />
              Coach qualité
            </label>
            <select
              id="q-filter-evaluator"
              className="select"
              value={filterEvaluator}
              onChange={(e) => setFilterEvaluator(e.target.value)}
            >
              <option value="">Tous les coaches</option>
              {evaluators.map((e) => (
                <option key={e.id} value={e.id}>{displayName(e)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="quality-filters-row quality-filters-row-dates">
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-from">
              <Calendar size={14} />
              Du
            </label>
            <input
              id="q-filter-from"
              type="date"
              className="input"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-to">
              <Calendar size={14} />
              Au
            </label>
            <input
              id="q-filter-to"
              type="date"
              className="input"
              value={filterTo}
              min={filterFrom || undefined}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
          <div className="quality-filters-actions">
            <button type="button" className="btn btn-primary" onClick={loadEvaluations} disabled={loading}>
              <Search size={16} />
              {loading ? "..." : "Appliquer"}
            </button>
            {hasActiveFilters && (
              <button type="button" className="btn btn-secondary" onClick={resetFilters} title="Réinitialiser les filtres">
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

      {hasActiveFilters && (
        <div className="quality-filters-active">
          <Filter size={14} />
          <span>Filtres actifs</span>
          {filterAgent && (() => {
            const a = agents.find((x) => x.id === filterAgent);
            return a ? (
              <span className="quality-filter-tag">Conseiller : {displayName(a)}</span>
            ) : null;
          })()}
          {filterCampaign && (
            <span className="quality-filter-tag">
              Campagne : {campaigns.find((c) => c.id === filterCampaign)?.name}
            </span>
          )}
          {filterEvaluator && (() => {
            const e = evaluators.find((x) => x.id === filterEvaluator);
            return e ? (
              <span className="quality-filter-tag">Coach : {displayName(e)}</span>
            ) : null;
          })()}
          {(filterFrom || filterTo) && (
            <span className="quality-filter-tag">
              Période : {filterFrom ? fmtDate(filterFrom) : "…"} → {filterTo ? fmtDate(filterTo) : "…"}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="quality-page">
      <header className="quality-header-bar">
        <div className="quality-header-main">
          <h1>Contrôle qualité</h1>
          <p className="quality-header-sub">
            Évaluateur : <strong>{coachDisplay}</strong>
            <span className="quality-header-sep">·</span>
            Ubicentrex → saisie grille CRM
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startNewEvaluation}>
          <Plus size={18} />
          Nouvelle écoute
        </button>
      </header>

      <nav className="quality-nav-tabs" aria-label="Navigation qualité">
        {primaryTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`quality-nav-tab ${t.cta ? "cta" : ""} ${isActiveTab(t.id) ? "active" : ""}`}
              onClick={() => {
                if (t.id === "nouvelle") startNewEvaluation();
                else {
                  setSelectedId(null);
                  setDetailEvaluator(null);
                  setTab(t.id);
                }
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
        <span className="quality-nav-sep" aria-hidden />
        {secondaryTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`quality-nav-tab secondary ${tab === t.id ? "active" : ""}`}
              onClick={() => {
                setSelectedId(null);
                setDetailEvaluator(null);
                setTab(t.id);
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "guide" && (
        <div style={{ display: "grid", gap: 20, maxWidth: 820 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{QUALITY_GUIDE.title}</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>{QUALITY_GUIDE.intro}</p>
          </div>
          <div className="card">
            <h3>Parcours recommandé</h3>
            <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 14 }}>
              {QUALITY_GUIDE.parcours.map((p) => (
                <li key={p.step} style={{ lineHeight: 1.55 }}>
                  <strong>{p.step}. {p.app}</strong>
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>({p.excel})</span>
                  <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{p.description}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h3>Re-notation après coaching</h3>
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
              {QUALITY_GUIDE.renotation.map((line) => (
                <li key={line} style={{ lineHeight: 1.55, fontSize: 14 }}>{line}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="btn btn-primary" onClick={startNewEvaluation}>
            <Plus size={18} />
            Commencer une écoute
          </button>
        </div>
      )}

      {tab === "referentiel" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Seuils & plafonds</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
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
              <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
                {criteria.map((criterion) => (
                  <div key={criterion.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{criterion.name}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {scoreOptions(criterion).map((score) => (
                        <div key={score} className="field" style={{ marginBottom: 0 }}>
                          <label className="label" style={{ fontSize: 12 }}>Barème {score}</label>
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
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleSaveReferential}>
              <Save size={18} />
              Enregistrer le référentiel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRefDraft(getDefaultReferential());
                toast.message("Référentiel par défaut rechargé (non enregistré)");
              }}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {(tab === "dashboard" || tab === "liste") && filtersBlock}

      {periodScoreBlock}

      {tab === "dashboard" && (
        <>
          <div className="quality-history-toolbar" style={{ marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>Pilotage qualité</span>
            {evaluations.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={exportingPdf || loading}
                onClick={() => handleExportPeriodPdf("dashboard")}
              >
                <FileDown size={16} />
                {exportingPdf ? "PDF…" : "Rapport direction PDF"}
              </button>
            )}
          </div>
          <div className="quality-kpi-strip">
            {[
              { label: "Écoutes", value: kpis.count },
              { label: "Moy. /20", value: kpis.avg },
              { label: "Moy. %", value: `${kpis.avgPercent}%` },
              { label: "Conformité", value: `${kpis.conformeRate}%` },
              { label: "Coaching", value: kpis.coaching },
              { label: "Action imm.", value: kpis.immediate },
            ].map((k) => (
              <div key={k.label} className="quality-kpi-strip-item">
                <span className="quality-kpi-strip-label">{k.label}</span>
                <span className="quality-kpi-strip-value">{k.value}</span>
              </div>
            ))}
          </div>

          {evaluations.length > 0 && (
            <section className="quality-section">
              <h3 className="quality-section-heading">Graphiques</h3>
              <QualityChartsGrid
                dailyData={dailyStats}
                agentData={agentChartData}
                domainData={domainChartData}
              />
            </section>
          )}

          <section className="quality-section">
            <h3 className="quality-section-heading">Par conseiller</h3>
            {agentStats.length === 0 ? (
              <p className="muted quality-section-empty">Aucune écoute sur la période.</p>
            ) : (
              <div className="quality-table-wrap">
                <table className="quality-data-table">
                  <thead>
                    <tr>
                      <th>Conseiller</th>
                      <th>Écoutes</th>
                      <th>Moy. /20</th>
                      <th>Moy. %</th>
                      <th>Conformité</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((a) => (
                      <tr key={a.id}>
                        <td className="quality-td-strong">{a.name}</td>
                        <td>{a.count}</td>
                        <td className="quality-td-strong">{a.avgScore}</td>
                        <td>{a.avgPercent}%</td>
                        <td>{a.conformRate}%</td>
                        <td className="quality-td-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Rapport PDF conseiller"
                            disabled={exportingPdf}
                            onClick={() => handleExportAgentPdf(a.id, a.name)}
                          >
                            <FileDown size={14} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {agentDailyStats.length > 0 && (
            <section className="quality-section">
              <h3 className="quality-section-heading">Par conseiller et par jour</h3>
              <div className="quality-table-wrap">
                <table className="quality-data-table">
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
                        <td className="quality-td-strong">{row.agentName}</td>
                        <td>{row.dateLabel}</td>
                        <td>{row.count}</td>
                        <td className="quality-td-strong">{row.avgScore}</td>
                        <td>{row.avgPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="quality-section">
            <h3 className="quality-section-heading">Par domaine</h3>
            <div className="quality-table-wrap">
              <table className="quality-data-table">
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
                      <td className="quality-td-strong">{d.avg}/{d.max}</td>
                      <td>{d.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {testDataPanel}
        </>
      )}

      {tab === "liste" && (
        <div>
          {!loading && evaluations.length > 0 && (
            <div className="quality-history-toolbar">
              <div className="quality-history-toolbar-left">
                <span className="muted" style={{ fontSize: 13 }}>
                  {evaluations.length} écoute{evaluations.length > 1 ? "s" : ""}
                </span>
                <span className="quality-history-export-hint muted">
                  Rapport direction : synthèse, graphiques et détail par conseiller
                </span>
              </div>
              <div className="quality-view-toggle">
                <button
                  type="button"
                  className={`quality-view-btn ${historyView === "list" ? "active" : ""}`}
                  onClick={() => setHistoryView("list")}
                >
                  <LayoutList size={16} />
                  Liste
                </button>
                <button
                  type="button"
                  className={`quality-view-btn ${historyView === "cards" ? "active" : ""}`}
                  onClick={() => setHistoryView("cards")}
                >
                  <LayoutGrid size={16} />
                  Cartes
                </button>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={exportingPdf || loading}
                onClick={() => handleExportHistoryPdf()}
                title="Synthèse, graphiques et détail par conseiller et par jour"
              >
                <FileDown size={16} />
                {exportingPdf ? "PDF…" : "Rapport direction PDF"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="quality-empty">Chargement...</p>
          ) : evaluations.length === 0 ? (
            <div className="quality-empty-block">
              <p>Aucune écoute sur la période.</p>
              <button type="button" className="btn btn-primary" onClick={startNewEvaluation}>
                <Plus size={18} />
                Première écoute
              </button>
            </div>
          ) : historyView === "list" ? (
            <div className="quality-table-wrap">
              <table className="quality-data-table quality-history-table">
                <thead>
                  <tr>
                    <th>Conseiller</th>
                    <th>Date</th>
                    <th>Écoute</th>
                    <th>Exact.</th>
                    <th>Proc.</th>
                    <th>Statut</th>
                    <th>Coach</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev) => {
                    const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
                    const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
                    const isTest = ev.externalCallId?.startsWith(QUALITY_TEST_CALL_PREFIX);
                    return (
                      <tr key={ev.id} className={isTest ? "quality-row-test" : undefined}>
                        <td className="quality-td-strong">
                          {isTest && <span className="badge quality-test-badge">TEST</span>}
                          {displayName(ev.agent)}
                        </td>
                        <td>
                          <div>{fmtDate(ev.evaluatedAt.slice(0, 10))}</div>
                          <div className="quality-td-muted">{ev.channel}</div>
                        </td>
                        <td className="quality-td-strong">
                          {ev.finalScore}/20
                          <span className="quality-td-muted"> ({ev.finalPercent ?? fmtPercent(ev.finalScore)}%)</span>
                        </td>
                        <td>
                          {exactScore ?? "—"}
                          {exactScore != null && (
                            <span className="quality-td-muted"> ({rdvCriterionPercent(CRITERION_EXACTITUDE, exactScore)}%)</span>
                          )}
                        </td>
                        <td>
                          {procScore ?? "—"}
                          {procScore != null && (
                            <span className="quality-td-muted"> ({rdvCriterionPercent(CRITERION_PROCEDURE, procScore)}%)</span>
                          )}
                        </td>
                        <td>{statusBadge(ev.status)}</td>
                        <td className="quality-td-muted">{displayName(ev.evaluator)}</td>
                        <td className="quality-td-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDetail(ev.id)}>
                            Ouvrir
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRenote(ev.id)}>
                            <RefreshCw size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Rapport écoute PDF"
                            disabled={exportingPdf}
                            onClick={() => exportEvaluationPdf(ev)}
                          >
                            <FileDown size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="quality-list-grid">
              {evaluations.map((ev) => {
                const exactScore = rdvCriterionScore(ev.scores, CRITERION_EXACTITUDE);
                const procScore = rdvCriterionScore(ev.scores, CRITERION_PROCEDURE);
                return (
                <article key={ev.id} className="quality-list-card">
                  <div className="quality-list-card-header">
                    <div>
                      <div className="quality-list-card-agent">{displayName(ev.agent)}</div>
                      <div className="quality-list-card-date">{fmtDate(ev.evaluatedAt.slice(0, 10))} · {ev.channel}</div>
                    </div>
                    {statusBadge(ev.status)}
                  </div>
                  {ev.externalCallId && (
                    <div className="quality-call-id muted">
                      {ev.externalCallId.startsWith(QUALITY_TEST_CALL_PREFIX) && (
                        <span className="badge quality-test-badge">TEST</span>
                      )}
                      {ev.externalCallId}
                    </div>
                  )}
                  <div className="quality-row-scores">
                    <span><strong>{ev.finalScore}</strong>/20</span>
                    <span>Exact. {exactScore ?? "—"}{exactScore != null && `/${CRITERION_RDV_MAX}`}</span>
                    <span>Proc. {procScore ?? "—"}{procScore != null && `/${CRITERION_RDV_MAX}`}</span>
                  </div>
                  <div className="quality-list-footer">
                    <span className="quality-list-evaluator">
                      <UserCircle size={14} />
                      {displayName(ev.evaluator)}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRenote(ev.id)}>
                        <RefreshCw size={14} />
                        Renoter
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Rapport écoute PDF"
                        disabled={exportingPdf}
                        onClick={() => exportEvaluationPdf(ev)}
                      >
                        <FileDown size={14} />
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDetail(ev.id)}>
                        Ouvrir
                      </button>
                    </div>
                  </div>
                </article>
              );})}
            </div>
          )}

          {testDataPanel}
        </div>
      )}

      {showForm && (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginBottom: 16 }}
            onClick={() => { resetForm(); setTab("liste"); }}
          >
            <ArrowLeft size={16} />
            Retour à l&apos;historique
          </button>

          <QualityFormWizard
            mode={formMode}
            step={formStep}
            onStepChange={goToStep}
            busy={busy}
            referential={referential}
            computed={computed}
            agents={agents}
            campaigns={campaigns}
            evaluatorLabel={evaluatorLabel}
            evaluatorInitials={evaluatorForDisplay ? initials(evaluatorForDisplay) : "—"}
            formExternalCallId={formExternalCallId}
            formDate={formDate}
            formAgentId={formAgentId}
            formCampaignId={formCampaignId}
            formChannel={formChannel}
            formScores={formScores}
            formComments={formComments}
            formPositive={formPositive}
            formActionPlan={formActionPlan}
            formDebriefDate={formDebriefDate}
            formDebriefConclusion={formDebriefConclusion}
            onExternalCallIdChange={setFormExternalCallId}
            onDateChange={setFormDate}
            onAgentChange={setFormAgentId}
            onCampaignChange={setFormCampaignId}
            onChannelChange={setFormChannel}
            onScoreChange={handleScoreChange}
            onCommentChange={(id, v) => setFormComments((prev) => ({ ...prev, [id]: v }))}
            onPositiveChange={setFormPositive}
            onActionPlanChange={(v) => {
              setActionPlanTouched(true);
              setFormActionPlan(v);
            }}
            onDebriefDateChange={setFormDebriefDate}
            onConclusionChange={(v) => {
              setDebriefConclusionTouched(true);
              setFormDebriefConclusion(v);
            }}
            onRegenerateActionPlan={regenerateActionPlan}
            onRegenerateConclusion={regenerateConclusion}
            onSave={handleSave}
            onPrint={formMode !== "create" ? handlePrint : undefined}
            onExportPdf={formMode !== "create" ? handleExportGrillePdf : undefined}
            exportingPdf={exportingPdf}
            onDelete={
              selectedId
                ? () => {
                    const ev = evaluations.find((e) => e.id === selectedId);
                    if (ev) setToDelete(ev);
                  }
                : undefined
            }
            renoteBanner={
              formMode === "renote" && selectedAgent && renotePreviousScore != null
                ? {
                    agentName: displayName(selectedAgent),
                    evaluatedAt: fmtDate(formDate),
                    previousScore: renotePreviousScore,
                  }
                : null
            }
            statusBadge={statusBadge}
          />
        </div>
      )}

      {showForm && (
        <>
          <div ref={printDialogRef} className="quality-pdf-root" aria-hidden>
            <QualityPrintGrille
              config={referential}
              evaluatedAt={formDate}
              agentName={selectedAgent ? displayName(selectedAgent) : "—"}
              evaluatorName={evaluatorLabel}
              campaignName={selectedCampaign?.name || ""}
              channel={formChannel}
              externalCallId={formExternalCallId.trim() || null}
              scores={formScores}
              comments={formComments}
              computed={computed}
              evaluationId={selectedId || undefined}
              positivePoints={formPositive.trim() || null}
              actionPlan={formActionPlan.trim() || null}
              debriefDate={formDebriefDate || null}
              debriefConclusion={formDebriefConclusion.trim() || null}
            />
          </div>
          {formMode !== "create" && (
            <div ref={individualPdfRef} className="quality-pdf-root" aria-hidden>
              <QualityIndividualExport
                config={referential}
                evaluatedAt={formDate}
                generatedAt={pdfGeneratedAt}
                agentName={selectedAgent ? displayName(selectedAgent) : "—"}
                evaluatorName={evaluatorLabel}
                campaignName={selectedCampaign?.name || ""}
                channel={formChannel}
                externalCallId={formExternalCallId.trim() || null}
                scores={formScores}
                comments={formComments}
                computed={computed}
                evaluationId={selectedId || undefined}
                positivePoints={formPositive.trim() || null}
                actionPlan={formActionPlan.trim() || null}
                debriefDate={formDebriefDate || null}
                debriefConclusion={formDebriefConclusion.trim() || null}
              />
            </div>
          )}
        </>
      )}

      <div ref={pdfSingleRef} className="quality-pdf-root" aria-hidden>
        {pdfSingleEv && (
          <QualityIndividualExport
            config={referential}
            evaluatedAt={pdfSingleEv.evaluatedAt.slice(0, 10)}
            generatedAt={pdfGeneratedAt}
            agentName={displayName(pdfSingleEv.agent)}
            evaluatorName={displayName(pdfSingleEv.evaluator)}
            campaignName={pdfSingleEv.campaign?.name || ""}
            channel={pdfSingleEv.channel}
            externalCallId={pdfSingleEv.externalCallId}
            scores={pdfSingleEv.scores}
            comments={pdfSingleEv.comments || {}}
            computed={{
              finalScore: pdfSingleEv.finalScore,
              finalPercent: pdfSingleEv.finalPercent ?? fmtPercent(pdfSingleEv.finalScore),
              mention: pdfSingleEv.mention,
              status: pdfSingleEv.status,
              totalPoints: pdfSingleEv.totalPoints,
            }}
            evaluationId={pdfSingleEv.id}
            positivePoints={pdfSingleEv.positivePoints}
            actionPlan={pdfSingleEv.actionPlan}
            debriefDate={pdfSingleEv.debriefDate?.slice(0, 10) || null}
            debriefConclusion={pdfSingleEv.debriefConclusion}
          />
        )}
      </div>

      <div ref={groupExportRef} className="quality-pdf-root" aria-hidden>
        {groupExportProps && (
          <QualityGroupExport
            {...groupExportProps}
            evaluatorDisplay={(evaluator) => displayName(evaluator)}
          />
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer cette écoute ?"
        message={toDelete ? `${fmtDate(toDelete.evaluatedAt.slice(0, 10))} — ${displayName(toDelete.agent)}` : ""}
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
