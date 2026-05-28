import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentChartPoint, DailyStat, DomainChartPoint } from "../../lib/quality-analytics";

const CHART_COLORS = {
  score: "#2563eb",
  percent: "#16a34a",
  count: "#7c3aed",
  domain: "#0ea5e9",
};

function StableChartHost({
  children,
  height = 280,
  fixedWidth,
}: {
  children: (width: number, height: number) => ReactNode;
  height?: number;
  fixedWidth?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fixedWidth ?? 0);

  useEffect(() => {
    if (fixedWidth) {
      setWidth(fixedWidth);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const w = Math.floor(host.getBoundingClientRect().width);
      if (w >= 120) setWidth(w);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(host);
    const t = window.setTimeout(measure, 120);
    return () => {
      ro?.disconnect();
      window.clearTimeout(t);
    };
  }, [fixedWidth]);

  if (fixedWidth) {
    return <div style={{ width: fixedWidth, height }}>{children(fixedWidth, height)}</div>;
  }

  return (
    <div ref={hostRef} style={{ width: "100%", height, minHeight: height }}>
      {width > 0 ? children(width, height) : null}
    </div>
  );
}

type ChartVariant = "screen" | "print";

function chartFontSize(variant: ChartVariant) {
  return variant === "print" ? 10 : 12;
}

export function QualityDailyTrendChart({
  data,
  variant = "screen",
  fixedWidth,
}: {
  data: DailyStat[];
  variant?: ChartVariant;
  fixedWidth?: number;
}) {
  if (!data.length) return null;
  const fs = chartFontSize(variant);
  return (
    <div className={`quality-chart-card ${variant === "print" ? "quality-chart-card-print" : ""}`}>
      <h4 className="quality-chart-title">Évolution du score moyen par jour</h4>
      <StableChartHost height={variant === "print" ? 220 : 280} fixedWidth={fixedWidth}>
        {(w, h) => (
          <ResponsiveContainer width={w} height={h}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: fs }} interval="preserveStartEnd" />
              <YAxis yAxisId="score" domain={[0, 20]} tick={{ fontSize: fs }} width={32} />
              <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: fs }} width={28} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "avgScore") return [`${value}/20`, "Score moyen"];
                  if (name === "count") return [value, "Écoutes"];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: fs }} />
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="avgScore"
                name="Score moyen (/20)"
                stroke={CHART_COLORS.score}
                strokeWidth={2}
                dot={{ r: variant === "print" ? 3 : 4 }}
              />
              <Bar yAxisId="count" dataKey="count" name="Écoutes" fill={CHART_COLORS.count} opacity={0.35} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </StableChartHost>
    </div>
  );
}

export function QualityAgentScoresChart({
  data,
  variant = "screen",
  fixedWidth,
}: {
  data: AgentChartPoint[];
  variant?: ChartVariant;
  fixedWidth?: number;
}) {
  if (!data.length) return null;
  const fs = chartFontSize(variant);
  return (
    <div className={`quality-chart-card ${variant === "print" ? "quality-chart-card-print" : ""}`}>
      <h4 className="quality-chart-title">Score moyen par conseiller</h4>
      <StableChartHost height={variant === "print" ? 240 : 300} fixedWidth={fixedWidth}>
        {(w, h) => (
          <ResponsiveContainer width={w} height={h}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: fs }} angle={-28} textAnchor="end" height={56} interval={0} />
              <YAxis domain={[0, 20]} tick={{ fontSize: fs }} width={32} />
              <Tooltip formatter={(value) => [`${value}/20`, "Score moyen"]} />
              <Bar dataKey="avgScore" name="Score moyen" fill={CHART_COLORS.score} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </StableChartHost>
    </div>
  );
}

export function QualityDomainScoresChart({
  data,
  variant = "screen",
  fixedWidth,
}: {
  data: DomainChartPoint[];
  variant?: ChartVariant;
  fixedWidth?: number;
}) {
  if (!data.length) return null;
  const fs = chartFontSize(variant);
  return (
    <div className={`quality-chart-card ${variant === "print" ? "quality-chart-card-print" : ""}`}>
      <h4 className="quality-chart-title">Performance par domaine (%)</h4>
      <StableChartHost height={variant === "print" ? 220 : 280} fixedWidth={fixedWidth}>
        {(w, h) => (
          <ResponsiveContainer width={w} height={h}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: fs }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: fs }} width={120} />
              <Tooltip formatter={(value) => [`${value}%`, "Taux"]} />
              <Bar dataKey="percent" name="%" fill={CHART_COLORS.domain} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </StableChartHost>
    </div>
  );
}

export function QualityChartsGrid({
  dailyData,
  agentData,
  domainData,
  variant = "screen",
  fixedWidth = 760,
}: {
  dailyData: DailyStat[];
  agentData: AgentChartPoint[];
  domainData: DomainChartPoint[];
  variant?: ChartVariant;
  fixedWidth?: number;
}) {
  const printW = variant === "print" ? fixedWidth : undefined;
  return (
    <div className={`quality-charts-grid ${variant === "print" ? "quality-charts-grid-print" : ""}`}>
      <QualityDailyTrendChart data={dailyData} variant={variant} fixedWidth={printW} />
      {agentData.length > 1 && (
        <QualityAgentScoresChart data={agentData} variant={variant} fixedWidth={printW} />
      )}
      <QualityDomainScoresChart data={domainData} variant={variant} fixedWidth={printW} />
    </div>
  );
}
