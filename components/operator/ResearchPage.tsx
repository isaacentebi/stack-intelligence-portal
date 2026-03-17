"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const KpiChart = dynamic(
  () => import("@/components/operator/KpiChart").then((m) => m.KpiChart),
  { ssr: false, loading: () => <div style={{ height: 140, background: "#fafafa" }} /> },
);

/* ── Types ────────────────────────────────────────────── */

interface HistoryPoint { period: string; value: number }

interface KPI {
  kpiId: string;
  name: string;
  value: number | null;
  units: string;
  band: string;
  observationPeriod: string;
  delta: number | null;
  history: HistoryPoint[];
  sourcePrimary: string;
  frequency: string;
  latency: string;
  qualityGrade: string;
  zScore: number | null;
  symbols: string[] | null;
}

interface Hypothesis {
  hypothesisId: string;
  trendId: string;
  trendName: string;
  claimSummary: string;
  tier: number;
  status: string;
  signal: string;
  owner: string | null;
  failureDefinition: string | null;
  confidenceScore: number | null;
  currentScenario: string | null;
  kpis: KPI[];
}

interface Trend {
  trendId: string;
  trendName: string;
  hypotheses: string[];
}

interface ResearchData {
  snapshot: string;
  computedAt: string;
  totals: { kpisDefined: number; kpisComputed: number; support: number; neutral: number; weaken: number; hypotheses: number };
  trends: Trend[];
  hypotheses: Hypothesis[];
  dependencies: { from: string; to: string; relationship: string }[];
}

/* ── Helpers ──────────────────────────────────────────── */

const SIG_BG: Record<string, string> = { support: "#e6f4ea", weaken: "#fde8e8", neutral: "#f3f3f3" };
const SIG_FG: Record<string, string> = { support: "#065c2d", weaken: "#991b1b", neutral: "#666" };
const SIG_LINE: Record<string, string> = { support: "#18A055", weaken: "#D94040", neutral: "#888" };

function SignalBadge({ signal }: { signal: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 500, letterSpacing: 0.3, textTransform: "uppercase" as const, background: SIG_BG[signal] ?? "#f3f3f3", color: SIG_FG[signal] ?? "#666" }}>
      {signal}
    </span>
  );
}

function fmtVal(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

function deltaColor(d: number | null): string {
  if (d == null) return "#888";
  return d > 0 ? "#18A055" : d < 0 ? "#D94040" : "#888";
}

function _KpiChartSvg({ history, band }: { history: HistoryPoint[]; band: string }) {
  const raw = (history ?? []).filter((h) => h.value != null && isFinite(h.value));
  if (raw.length < 2) return <div style={{ height: 120, background: "#fafafa", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#ccc" }}>No data</div>;

  const W = 400, H = 120;
  const padL = 48, padR = 8, padT = 8, padB = 24;
  const gw = W - padL - padR, gh = H - padT - padB;

  const values = raw.map((h) => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const color = SIG_LINE[band] ?? "#888";

  // Points
  const pts = raw.map((h, i) => ({
    x: padL + (i / (raw.length - 1)) * gw,
    y: padT + gh - ((h.value - min) / range) * gh,
    date: h.period,
    val: h.value,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = line + ` L${(padL + gw).toFixed(1)},${(padT + gh).toFixed(1)} L${padL},${(padT + gh).toFixed(1)} Z`;
  const last = pts[pts.length - 1];

  // Y-axis: 4 ticks
  const yTicks = [0, 0.33, 0.67, 1].map((t) => ({
    val: min + t * range,
    y: padT + gh - t * gh,
  }));

  // X-axis: ~5 date labels
  const step = Math.max(1, Math.floor(raw.length / 5));
  const xTicks = raw.filter((_, i) => i % step === 0 || i === raw.length - 1).map((h, idx, arr) => ({
    label: new Date(h.period).getFullYear().toString(),
    x: padL + ((raw.indexOf(h)) / (raw.length - 1)) * gw,
  }));
  // Deduplicate years
  const seenYears = new Set<string>();
  const xLabels = xTicks.filter((t) => { if (seenYears.has(t.label)) return false; seenYears.add(t.label); return true; });

  const fmtAxis = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
    if (abs >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    if (abs >= 1000) return `${(v / 1000).toFixed(0)}K`;
    if (abs >= 10) return v.toFixed(0);
    if (abs >= 1) return v.toFixed(1);
    return v.toFixed(2);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#f0f0f0" strokeWidth={0.5} />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={padL - 4} y={t.y + 3} textAnchor="end" fill="#bbb" fontSize={8} fontFamily="'JetBrains Mono', monospace">
          {fmtAxis(t.val)}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((t, i) => (
        <text key={i} x={t.x} y={H - 4} textAnchor="middle" fill="#bbb" fontSize={8} fontFamily="'JetBrains Mono', monospace">
          {t.label}
        </text>
      ))}

      {/* Area + line */}
      <path d={area} fill={color} opacity={0.05} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Current value dot + label */}
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
      <circle cx={last.x} cy={last.y} r={6} fill={color} opacity={0.15} />
      <text x={last.x - 4} y={last.y - 8} textAnchor="end" fill={color} fontSize={9} fontWeight={600} fontFamily="'JetBrains Mono', monospace">
        {fmtAxis(last.val)}
      </text>
    </svg>
  );
}

/* ── Main Component ──────────────────────────────────── */

export function ResearchPage() {
  const router = useRouter();
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTrend, setExpandedTrend] = useState<string | null>(null);
  const [expandedHypos, setExpandedHypos] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/research/live", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="op-loading" style={{ minHeight: 400 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 32 }}>{error}</div>;
  if (!data) return null;

  const hypoMap = new Map(data.hypotheses.map((h) => [h.hypothesisId, h]));

  // Build dependency lookup: for each hypothesis, what it requires and what depends on it
  const deps = data.dependencies ?? [];
  const requiresMap = new Map<string, string[]>(); // hypo → [what it requires]
  const feedsIntoMap = new Map<string, string[]>(); // hypo → [what depends on it]
  for (const d of deps) {
    // "from" requires "to": H-102 requires H-101
    requiresMap.set(d.from, [...(requiresMap.get(d.from) ?? []), d.to]);
    feedsIntoMap.set(d.to, [...(feedsIntoMap.get(d.to) ?? []), d.from]);
  }

  function toggleHypo(id: string) {
    setExpandedHypos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function trendSignal(trend: Trend): string {
    const hypos = trend.hypotheses.map((id) => hypoMap.get(id)).filter(Boolean) as Hypothesis[];
    if (hypos.some((h) => h.signal === "weaken")) return "weaken";
    if (hypos.some((h) => h.signal === "support")) return "support";
    return "neutral";
  }

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Research Framework</h1>
          <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>
            {data.trends.length} trends · {data.totals.hypotheses} hypotheses · {data.totals.kpisComputed}/{data.totals.kpisDefined} KPIs · Snapshot {daysAgo(data.snapshot)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="co-panel-grid" style={{ marginBottom: 24 }}>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{data.totals.kpisComputed}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>KPIs Computed</div>
        </div>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#18A055" }}>{data.totals.support}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Support</div>
        </div>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#888" }}>{data.totals.neutral}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Neutral</div>
        </div>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#D94040" }}>{data.totals.weaken}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Weaken</div>
        </div>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{data.totals.hypotheses}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Hypotheses</div>
        </div>
      </div>

      {/* Trends */}
      <div style={{ display: "grid", gap: 8 }}>
        {data.trends.map((trend) => {
          const tOpen = expandedTrend === trend.trendId;
          const trendHypos = trend.hypotheses.map((id) => hypoMap.get(id)).filter(Boolean) as Hypothesis[];
          const agg = trendSignal(trend);

          return (
            <div key={trend.trendId} style={{ border: "1px solid #e5e5e5", background: "#fff" }}>
              {/* Trend header */}
              <button
                type="button"
                onClick={() => setExpandedTrend(tOpen ? null : trend.trendId)}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 20px", boxSizing: "border-box" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, color: "#ccc" }}>{tOpen ? "▼" : "▶"}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#aaa" }}>{trend.trendId}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{trend.trendName}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{trendHypos.length} hypotheses</span>
                  <SignalBadge signal={agg} />
                </div>
              </button>

              {/* Hypotheses */}
              {tOpen && (
                <div style={{ borderTop: "1px solid #f0f0f0" }}>
                  {trendHypos.map((hypo) => {
                    const hOpen = expandedHypos.has(hypo.hypothesisId);
                    return (
                      <div key={hypo.hypothesisId} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        {/* Hypothesis header */}
                        <button
                          type="button"
                          onClick={() => toggleHypo(hypo.hypothesisId)}
                          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%", padding: "12px 20px 12px 40px", boxSizing: "border-box" }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: "#ccc" }}>{hOpen ? "▼" : "▶"}</span>
                              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#aaa" }}>{hypo.hypothesisId}</span>
                              <SignalBadge signal={hypo.signal} />
                              <span style={{ fontSize: 11, padding: "2px 6px", background: "#f3f3f3", borderRadius: 3, color: "#666" }}>Tier {hypo.tier}</span>
                              <span style={{ fontSize: 11, color: "#bbb" }}>{hypo.kpis.length} KPIs</span>
                              {hypo.confidenceScore != null && (
                                <span style={{ fontSize: 11, color: "#aaa" }}>Conf: {Math.round(hypo.confidenceScore * 100)}%</span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, color: "#333", lineHeight: 1.5, marginLeft: 20 }}>{hypo.claimSummary}</div>
                            {hypo.currentScenario && (
                              <div style={{ fontSize: 12, color: "#0B5EA8", marginLeft: 20, marginTop: 4 }}>Scenario: {hypo.currentScenario}</div>
                            )}
                          </div>
                          {hypo.owner && (
                            <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0, marginLeft: 12 }}>{hypo.owner}</span>
                          )}
                        </button>

                        {/* KPI cards */}
                        {hOpen && (
                          <div style={{ padding: "4px 20px 16px 60px" }}>
                            {/* Failure definition */}
                            {hypo.failureDefinition && (
                              <div style={{ fontSize: 13, color: "#D94040", marginBottom: 12, padding: "8px 12px", background: "#fff5f5", border: "1px solid #fde8e8", borderRadius: 3, lineHeight: 1.5 }}>
                                <span style={{ fontWeight: 500 }}>Falsification: </span>{hypo.failureDefinition}
                              </div>
                            )}

                            {/* Dependencies */}
                            {((requiresMap.get(hypo.hypothesisId) ?? []).length > 0 || (feedsIntoMap.get(hypo.hypothesisId) ?? []).length > 0) && (
                              <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
                                {(requiresMap.get(hypo.hypothesisId) ?? []).length > 0 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#18A055", textTransform: "uppercase", letterSpacing: 0.3 }}>Requires</span>
                                    {requiresMap.get(hypo.hypothesisId)!.map((depId) => {
                                      const dep = hypoMap.get(depId);
                                      return (
                                        <button key={depId} type="button" onClick={() => { setExpandedTrend(dep?.trendId ?? null); toggleHypo(depId); }} style={{ all: "unset", cursor: "pointer", fontSize: 12, padding: "3px 8px", background: "#f3f3f3", borderRadius: 3, color: "#333" }}>
                                          <strong style={{ color: "#18A055", marginRight: 4 }}>{depId}</strong>
                                          {dep?.claimSummary?.slice(0, 40)}{(dep?.claimSummary?.length ?? 0) > 40 ? "…" : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {(feedsIntoMap.get(hypo.hypothesisId) ?? []).length > 0 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: "#0B5EA8", textTransform: "uppercase", letterSpacing: 0.3 }}>Feeds Into</span>
                                    {feedsIntoMap.get(hypo.hypothesisId)!.map((depId) => {
                                      const dep = hypoMap.get(depId);
                                      return (
                                        <button key={depId} type="button" onClick={() => { setExpandedTrend(dep?.trendId ?? null); toggleHypo(depId); }} style={{ all: "unset", cursor: "pointer", fontSize: 12, padding: "3px 8px", background: "#f3f3f3", borderRadius: 3, color: "#333" }}>
                                          <strong style={{ color: "#0B5EA8", marginRight: 4 }}>{depId}</strong>
                                          {dep?.claimSummary?.slice(0, 40)}{(dep?.claimSummary?.length ?? 0) > 40 ? "…" : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
                              {hypo.kpis.map((kpi) => (
                                <div key={kpi.kpiId} style={{ border: "1px solid #e5e5e5", background: "#fff", padding: "16px 18px", borderLeft: `3px solid ${SIG_LINE[kpi.band] ?? "#ddd"}` }}>
                                  {/* Header: name + signal + quality */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111", lineHeight: 1.4, flex: 1, marginRight: 12 }}>{kpi.name}</div>
                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                      <SignalBadge signal={kpi.band} />
                                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, background: kpi.qualityGrade === "A" ? "#e6f4ea" : kpi.qualityGrade === "B" ? "#e8f0fe" : "#f3f3f3", color: kpi.qualityGrade === "A" ? "#065c2d" : kpi.qualityGrade === "B" ? "#0b5ea8" : "#666" }}>
                                        {kpi.qualityGrade}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Value hero */}
                                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: "#111" }}>{fmtVal(kpi.value)}</span>
                                    <span style={{ fontSize: 12, color: "#aaa" }}>{kpi.units}</span>
                                    {kpi.delta != null && (
                                      <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 500, color: deltaColor(kpi.delta) }}>
                                        {kpi.delta > 0 ? "+" : ""}{fmtVal(kpi.delta)}
                                      </span>
                                    )}
                                    {kpi.zScore != null && (
                                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: deltaColor(kpi.zScore), padding: "2px 6px", background: kpi.zScore > 0.75 ? "#e6f4ea" : kpi.zScore < -0.5 ? "#fde8e8" : "#f3f3f3", borderRadius: 3 }}>
                                        z = {kpi.zScore.toFixed(2)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Chart — TradingView lightweight-charts */}
                                  <div style={{ marginBottom: 10 }}>
                                    <KpiChart history={kpi.history} color={SIG_LINE[kpi.band] ?? "#888"} height={140} />
                                  </div>

                                  {/* Footer: meta + tickers */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 12, color: "#bbb" }}>
                                      {daysAgo(kpi.observationPeriod)} · {kpi.frequency} · {kpi.sourcePrimary?.split(":")[0]?.split("(")[0]?.trim()}
                                    </span>
                                    {kpi.symbols && kpi.symbols.length > 0 && (
                                      <div style={{ display: "flex", gap: 4 }}>
                                        {kpi.symbols.map((s) => (
                                          <button key={s} type="button" onClick={() => router.push(`/operator/companies/${s}`)} style={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 500, color: "#0D7A3E", padding: "1px 5px", background: "#e6f4ea", borderRadius: 2 }}>{s}</button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
