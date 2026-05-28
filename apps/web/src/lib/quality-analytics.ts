import type { QualityEvaluation } from "@crc/types";
import { fmtDate, fmtPercent } from "./quality-utils";

export type DailyStat = {
  date: string;
  label: string;
  count: number;
  avgScore: number;
  avgPercent: number;
};

export type AgentDailyStat = {
  agentId: string;
  agentName: string;
  date: string;
  dateLabel: string;
  count: number;
  avgScore: number;
  avgPercent: number;
};

export type AgentChartPoint = {
  name: string;
  avgScore: number;
  avgPercent: number;
  count: number;
};

export type DomainChartPoint = {
  name: string;
  percent: number;
  avg: number;
  max: number;
};

export function buildDailyStats(evaluations: QualityEvaluation[]): DailyStat[] {
  const map = new Map<string, { scores: number[]; pcts: number[] }>();
  for (const ev of evaluations) {
    const date = ev.evaluatedAt.slice(0, 10);
    const cur = map.get(date) || { scores: [], pcts: [] };
    cur.scores.push(ev.finalScore);
    cur.pcts.push(ev.finalPercent ?? fmtPercent(ev.finalScore));
    map.set(date, cur);
  }
  return Array.from(map.entries())
    .map(([date, row]) => ({
      date,
      label: fmtDate(date),
      count: row.scores.length,
      avgScore: Math.round((row.scores.reduce((a, b) => a + b, 0) / row.scores.length) * 10) / 10,
      avgPercent: Math.round((row.pcts.reduce((a, b) => a + b, 0) / row.pcts.length) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildAgentDailyStats(
  evaluations: QualityEvaluation[],
  agentName: (agent: QualityEvaluation["agent"]) => string,
): AgentDailyStat[] {
  const map = new Map<
    string,
    { agentId: string; agentName: string; date: string; scores: number[]; pcts: number[] }
  >();
  for (const ev of evaluations) {
    const date = ev.evaluatedAt.slice(0, 10);
    const key = `${ev.agent.id}|${date}`;
    const cur = map.get(key) || {
      agentId: ev.agent.id,
      agentName: agentName(ev.agent),
      date,
      scores: [],
      pcts: [],
    };
    cur.scores.push(ev.finalScore);
    cur.pcts.push(ev.finalPercent ?? fmtPercent(ev.finalScore));
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((row) => ({
      agentId: row.agentId,
      agentName: row.agentName,
      date: row.date,
      dateLabel: fmtDate(row.date),
      count: row.scores.length,
      avgScore: Math.round((row.scores.reduce((a, b) => a + b, 0) / row.scores.length) * 10) / 10,
      avgPercent: Math.round((row.pcts.reduce((a, b) => a + b, 0) / row.pcts.length) * 10) / 10,
    }))
    .sort((a, b) => a.agentName.localeCompare(b.agentName, "fr") || a.date.localeCompare(b.date));
}

export function buildAgentChartData(
  agentStats: { name: string; avgScore: number; avgPercent: number; count: number }[],
): AgentChartPoint[] {
  return agentStats.map((a) => ({
    name: a.name.length > 18 ? `${a.name.slice(0, 16)}…` : a.name,
    avgScore: a.avgScore,
    avgPercent: a.avgPercent,
    count: a.count,
  }));
}

export function buildDomainChartData(
  domainStats: { domain: string; avg: number; max: number; percent: number }[],
): DomainChartPoint[] {
  return domainStats.map((d) => ({
    name: d.domain.length > 22 ? `${d.domain.slice(0, 20)}…` : d.domain,
    percent: d.percent,
    avg: d.avg,
    max: d.max,
  }));
}

export function filterEvaluationsForAgent(
  evaluations: QualityEvaluation[],
  agentId: string,
): QualityEvaluation[] {
  return evaluations.filter((ev) => ev.agent.id === agentId);
}

export function agentKpisFromEvaluations(evaluations: QualityEvaluation[]) {
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
}

export type AgentEvaluationGroup = {
  agentId: string;
  agentName: string;
  count: number;
  avgScore: number;
  avgPercent: number;
  evaluations: QualityEvaluation[];
};

/** Regroupe les écoutes par conseiller, triées par nom puis date décroissante. */
export function groupEvaluationsByAgent(
  evaluations: QualityEvaluation[],
  agentName: (agent: QualityEvaluation["agent"]) => string,
): AgentEvaluationGroup[] {
  const map = new Map<string, AgentEvaluationGroup>();
  for (const ev of evaluations) {
    const id = ev.agent.id;
    let group = map.get(id);
    if (!group) {
      group = { agentId: id, agentName: agentName(ev.agent), count: 0, avgScore: 0, avgPercent: 0, evaluations: [] };
      map.set(id, group);
    }
    group.evaluations.push(ev);
  }
  return Array.from(map.values())
    .map((group) => {
      const sorted = [...group.evaluations].sort(
        (a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt) || b.id.localeCompare(a.id),
      );
      const n = sorted.length;
      const avgScore = Math.round((sorted.reduce((s, e) => s + e.finalScore, 0) / n) * 10) / 10;
      const avgPercent = Math.round(
        (sorted.reduce((s, e) => s + (e.finalPercent ?? fmtPercent(e.finalScore)), 0) / n) * 10,
      ) / 10;
      return { ...group, count: n, avgScore, avgPercent, evaluations: sorted };
    })
    .sort((a, b) => a.agentName.localeCompare(b.agentName, "fr"));
}
