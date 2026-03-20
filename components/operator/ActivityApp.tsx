"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useCompanyActivity,
  useCompanyActivityWider,
  useAnalysisAgents,
  useTriggerLedger,
} from "@/lib/hooks/use-operator";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SL = { fontSize: 11, fontWeight: 500 as const, textTransform: "uppercase" as const, letterSpacing: 0.3, color: "#aaa", marginBottom: 12 };

const DECISION_STYLE: Record<string, { bg: string; fg: string }> = {
  forward_to_company_analyst: { bg: "#e8f0fe", fg: "#0b5ea8" },
  skip_already_reflected: { bg: "#f3f3f3", fg: "#888" },
  skip_judgment_newer: { bg: "#f3f3f3", fg: "#888" },
  blocked_by_freshness_guard: { bg: "#fef3cd", fg: "#8c5b00" },
  awaiting_provider_refresh: { bg: "#fef3cd", fg: "#8c5b00" },
  informational: { bg: "#fafafa", fg: "#aaa" },
};

export function ActivityApp() {
  const router = useRouter();
  const [lookback, setLookback] = useState(1);
  const [triageExpanded, setTriageExpanded] = useState(false);
  const [ledgerSource, setLedgerSource] = useState("all");
  const [ledgerEnabled, setLedgerEnabled] = useState(false);

  // ── SWR hooks (parallel, no waterfall) ────────────────
  const { data: activity, error: activityError, isLoading: activityLoading, mutate: refreshActivity } = useCompanyActivity(lookback);
  const { data: agents } = useAnalysisAgents();
  const { data: ledger, isLoading: ledgerLoading } = useTriggerLedger(ledgerSource, ledgerEnabled);

  // Derive which tickers need the wider 24h window
  const missingTickers = useMemo(() => {
    if (!activity) return [];
    const ctx: Record<string, boolean> = {};
    for (const t of activity.news_triage?.items ?? []) ctx[t.ticker] = true;
    return (activity.company_analyst_targets?.targets ?? [])
      .filter((t: any) => !ctx[t.ticker])
      .map((t: any) => t.ticker);
  }, [activity]);

  // Only fires when there are targets missing from the current triage window
  const { data: widerActivity } = useCompanyActivityWider(missingTickers.length > 0);

  // Derive triageContext from activity + wider window (replaces manual state)
  const triageContext = useMemo(() => {
    const ctx: Record<string, any> = {};
    for (const t of activity?.news_triage?.items ?? []) ctx[t.ticker] = t;
    if (widerActivity && missingTickers.length > 0) {
      for (const t of widerActivity.news_triage?.items ?? []) {
        if (missingTickers.includes(t.ticker)) ctx[t.ticker] = t;
      }
    }
    return ctx;
  }, [activity, widerActivity, missingTickers]);

  if (activityError) return <div className="op-error" style={{ margin: 20 }}>{activityError instanceof Error ? activityError.message : "Failed to load activity"}</div>;

  const newsScan = activity?.news_scan ?? {};
  const triage = activity?.news_triage ?? {};
  const targets = activity?.company_analyst_targets ?? {};
  const triageItems: any[] = triage.items ?? [];
  const targetItems: any[] = targets.targets ?? [];
  const scanItems: any[] = newsScan.items ?? [];
  const ledgerItems: any[] = ledger?.items ?? [];
  const ledgerDecisionCounts: Record<string, number> = ledger?.decision_counts ?? {};
  const ledgerSourceCounts: Record<string, number> = ledger?.source_counts ?? {};

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Company Analysis Activity</h1>
          <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>
            Last {lookback}h window{activity ? <> · {activity.registry_ticker_count ?? 0} companies · Generated {timeAgo(activity.generated_at)}</> : " · Loading..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[1, 4, 12, 24].map((h) => (
            <button key={h} type="button" onClick={() => setLookback(h)} style={{
              all: "unset", cursor: "pointer", fontSize: 12, padding: "4px 12px", borderRadius: 3,
              background: lookback === h ? "#111" : "#f3f3f3", color: lookback === h ? "#fff" : "#666", fontWeight: lookback === h ? 500 : 400,
            }}>{h}h</button>
          ))}
          <button type="button" onClick={() => refreshActivity()} className="fin-btn fin-btn--on" style={{ padding: "6px 16px", marginLeft: 8 }}>Refresh</button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────── */}
      {!activity && activityLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><span className="op-spinner" /></div>
      ) : (
        <div className="co-panel-grid" style={{ marginBottom: 20 }}>
          <div className="co-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{newsScan.tickers_with_high_signal_news ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>High-Signal News</div>
          </div>
          <div className="co-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{triage.triaged_ticker_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Triaged</div>
          </div>
          <div className="co-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: triage.rerun_recommended_count > 0 ? "#0D7A3E" : "#111" }}>{triage.rerun_recommended_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Rerun Recommended</div>
          </div>
          <div className="co-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: triage.forwarded_to_company_analyst_count > 0 ? "#0D7A3E" : "#111" }}>{triage.forwarded_to_company_analyst_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Forwarded to Analyst</div>
          </div>
          <div className="co-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{targets.target_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Analyst Targets</div>
          </div>
        </div>
      )}

      {/* ── Company Analyst Targets ───────────────────── */}
      {targetItems.length > 0 && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={SL}>Company Analyst Targets ({targetItems.length})</div>
            <span style={{ fontSize: 12, color: "#888" }}>Triggered this cycle — will appear in Reviews if changes are proposed</span>
          </div>
          {targetItems.map((t: any) => {
            const triageMatch = triageContext[t.ticker] ?? null;
            return (
              <div key={t.ticker} style={{ padding: "14px 16px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: triageMatch?.summary ? 8 : 0 }}>
                  <button type="button" onClick={() => router.push(`/operator/companies/${t.ticker}`)} style={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 15, fontWeight: 600, color: "#0D7A3E" }}>{t.ticker}</button>
                  {(t.reasons ?? []).map((r: string) => (
                    <span key={r} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: r.includes("news") ? "#e8f0fe" : r.includes("transcript") ? "#f0f8f3" : "#f3f3f3", color: r.includes("news") ? "#0b5ea8" : r.includes("transcript") ? "#0D7A3E" : "#666" }}>
                      {humanize(r)}
                    </span>
                  ))}
                  {triageMatch?.generated_at && (
                    <span style={{ fontSize: 11, color: "#aaa" }}>Triaged {timeShort(triageMatch.generated_at)}</span>
                  )}
                  {triageMatch?.confidence && (
                    <span style={{ fontSize: 11, color: triageMatch.confidence === "high" ? "#18A055" : triageMatch.confidence === "medium" ? "#8c5b00" : "#D94040", marginLeft: "auto" }}>
                      {humanize(triageMatch.confidence)} confidence
                    </span>
                  )}
                  {(triageMatch?.likely_affected_nodes ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {triageMatch.likely_affected_nodes.map((n: string) => (
                        <span key={n} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#888", padding: "1px 6px", background: "#f0f0f0", borderRadius: 2 }}>{n}</span>
                      ))}
                    </div>
                  )}
                </div>
                {triageMatch?.summary && (
                  <p style={{ fontSize: 14, color: "#444", margin: 0, lineHeight: 1.6 }}>{triageMatch.summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── News Triage Detail ────────────────────────── */}
      {triageItems.length > 0 && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={SL}>News Triage ({triageItems.length} tickers)</div>
            <button type="button" onClick={() => setTriageExpanded(!triageExpanded)} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#0D7A3E" }}>
              {triageExpanded ? "Collapse" : "Show all"}
            </button>
          </div>

          {/* Rerun/forwarded items at top */}
          {triageItems.filter((t: any) => t.rerun_company || t.forwarded_to_company_analyst).map((t: any) => (
            <div key={t.ticker} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f3f3" }}>
              <button type="button" onClick={() => router.push(`/operator/companies/${t.ticker}`)} style={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 600, color: "#0D7A3E", minWidth: 80 }}>{t.ticker}</button>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  {t.rerun_company && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: "#f0f8f3", color: "#0D7A3E" }}>Rerun Recommended</span>}
                  {t.forwarded_to_company_analyst && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: "#e8f0fe", color: "#0b5ea8" }}>Forwarded to Analyst</span>}
                  <span style={{ fontSize: 10, color: "#bbb" }}>{timeShort(t.generated_at)}</span>
                </div>
                {t.summary && <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{t.summary}</p>}
                {(t.likely_affected_nodes ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {t.likely_affected_nodes.map((n: string) => (
                      <span key={n} style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "#888", padding: "1px 5px", background: "#f3f3f3", borderRadius: 2 }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Full triage table */}
          {triageExpanded && (
            <div className="co-fin-table-wrap" style={{ marginTop: 12 }}>
              <table className="fin-table">
                <thead>
                  <tr>
                    <th className="fin-th-label">Ticker</th>
                    <th className="fin-th-period">Triaged</th>
                    <th className="fin-th-period">Rerun</th>
                    <th className="fin-th-period">Reflected</th>
                    <th className="fin-th-period">Forwarded</th>
                    <th className="fin-th-period">Nodes</th>
                    <th className="fin-th-period">Confidence</th>
                    <th className="fin-th-label">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {triageItems.map((t: any) => (
                    <tr key={t.ticker} style={{ cursor: "pointer" }} onClick={() => router.push(`/operator/companies/${t.ticker}`)}>
                      <td className="fin-td-label" style={{ fontFamily: "var(--font-data)", fontWeight: 600, color: "#0D7A3E", fontSize: 13 }}>{t.ticker}</td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{timeShort(t.generated_at)}</td>
                      <td className="fin-td-value">{t.rerun_company ? <span style={{ fontSize: 11, fontWeight: 600, color: "#0D7A3E" }}>Yes</span> : <span style={{ fontSize: 11, color: "#ccc" }}>No</span>}</td>
                      <td className="fin-td-value">{t.already_reflected_in_current_state ? <span style={{ fontSize: 11, color: "#888" }}>Yes</span> : <span style={{ fontSize: 11, color: "#ccc" }}>No</span>}</td>
                      <td className="fin-td-value">{t.forwarded_to_company_analyst ? <span style={{ fontSize: 11, fontWeight: 600, color: "#0b5ea8" }}>Yes</span> : <span style={{ fontSize: 11, color: "#ccc" }}>No</span>}</td>
                      <td className="fin-td-value" style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "#888" }}>{(t.likely_affected_nodes ?? []).join(", ") || "None"}</td>
                      <td className="fin-td-value"><span style={{ fontSize: 11, color: t.confidence === "high" ? "#18A055" : t.confidence === "medium" ? "#8c5b00" : "#D94040" }}>{t.confidence ?? "—"}</span></td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#666", lineHeight: 1.4, borderBottom: "1px solid #f3f3f3", maxWidth: 400 }}>{t.summary ? (t.summary.length > 120 ? t.summary.slice(0, 117) + "..." : t.summary) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── News Scan ─────────────────────────────────── */}
      {scanItems.length > 0 && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
          <div style={SL}>News Scan — {scanItems.length} tickers fetched</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {scanItems.map((s: any) => (
              <span key={s.ticker} style={{
                fontFamily: "var(--font-data)", fontSize: 11, padding: "3px 8px", borderRadius: 2, cursor: "pointer",
                background: s.high_signal_news_count > 0 ? "#f0f8f3" : "#fafafa",
                border: s.high_signal_news_count > 0 ? "1px solid #d4e8da" : "1px solid #eee",
                color: s.high_signal_news_count > 0 ? "#0D7A3E" : "#aaa",
                fontWeight: s.high_signal_news_count > 0 ? 500 : 400,
              }} onClick={() => router.push(`/operator/companies/${s.ticker}`)}>
                {s.ticker}{s.high_signal_news_count > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: "#18A055" }}>{s.high_signal_news_count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Company Trigger Ledger (load on demand) ──── */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ledger ? 14 : 0 }}>
          <div style={SL}>Company Trigger Ledger{ledger ? ` (${ledger.total_count ?? 0} total)` : ""}</div>
          {!ledger && !ledgerLoading && (
            <button type="button" onClick={() => setLedgerEnabled(true)} className="fin-btn fin-btn--on" style={{ padding: "4px 14px", fontSize: 12 }}>
              Load Ledger
            </button>
          )}
          {ledgerLoading && <span style={{ fontSize: 12, color: "#999" }}>Loading... (this can take a minute)</span>}
          {ledger && (
            <div style={{ display: "flex", gap: 6 }}>
              {["all", ...Object.keys(ledgerSourceCounts)].map((s) => (
                <button key={s} type="button" onClick={() => setLedgerSource(s)} style={{
                  all: "unset", cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 2,
                  background: ledgerSource === s ? "#111" : "#f3f3f3", color: ledgerSource === s ? "#fff" : "#666",
                }}>
                  {s === "all" ? "All" : humanize(s)} {s !== "all" && `(${ledgerSourceCounts[s] ?? 0})`}
                </button>
              ))}
            </div>
          )}
        </div>

        {!ledger && !ledgerLoading && (
          <p style={{ fontSize: 13, color: "#bbb", margin: 0 }}>Trigger ledger is a detailed audit log. Click &ldquo;Load Ledger&rdquo; to fetch — takes ~30s on large universes.</p>
        )}

        {/* Decision breakdown */}
        {ledger && Object.keys(ledgerDecisionCounts).length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(ledgerDecisionCounts).map(([decision, count]) => {
              const ds = DECISION_STYLE[decision] ?? DECISION_STYLE.informational;
              return (
                <div key={decision} style={{ padding: "6px 12px", background: ds.bg, borderRadius: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: ds.fg, fontWeight: 500 }}>{count}</span>
                  <span style={{ fontSize: 11, color: ds.fg }}>{humanize(decision)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ledger table */}
        {ledgerItems.length > 0 && (
          <div className="co-fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th className="fin-th-label">Ticker</th>
                  <th className="fin-th-period">Source</th>
                  <th className="fin-th-period">Trigger</th>
                  <th className="fin-th-period">Decision</th>
                  <th className="fin-th-period">Fwd</th>
                  <th className="fin-th-period">Triggered</th>
                  <th className="fin-th-period">Judgment</th>
                  <th className="fin-th-label">Reason</th>
                </tr>
              </thead>
              <tbody>
                {ledgerItems.map((item: any, idx: number) => {
                  const ds = DECISION_STYLE[item.decision] ?? DECISION_STYLE.informational;
                  return (
                    <tr key={`${item.ticker}-${idx}`} style={{ cursor: "pointer" }} onClick={() => router.push(`/operator/companies/${item.ticker}`)}>
                      <td className="fin-td-label" style={{ fontFamily: "var(--font-data)", fontWeight: 600, color: "#0D7A3E", fontSize: 13 }}>{item.ticker}</td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{humanize(item.trigger_source ?? "—")}</td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{humanize(item.trigger_reason ?? "—")}</td>
                      <td className="fin-td-value">
                        <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 2, background: ds.bg, color: ds.fg }}>{humanize(item.decision ?? "—")}</span>
                      </td>
                      <td className="fin-td-value">{item.forwarded ? <span style={{ fontSize: 10, fontWeight: 600, color: "#0b5ea8" }}>Yes</span> : <span style={{ fontSize: 10, color: "#ccc" }}>—</span>}</td>
                      <td className="fin-td-value" style={{ fontSize: 12, color: "#888" }}>{timeShort(item.triggered_at)}</td>
                      <td className="fin-td-value" style={{ fontSize: 12, color: "#888" }}>{timeAgo(item.judgment_generated_at)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#666", lineHeight: 1.4, borderBottom: "1px solid #f3f3f3", maxWidth: 350 }}>
                        {item.decision_reason ? (item.decision_reason.length > 100 ? item.decision_reason.slice(0, 97) + "..." : item.decision_reason) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Analysis Agents (collapsed at bottom) ────── */}
      {agents && (agents.agents ?? []).length > 0 && (
        <details style={{ border: "1px solid #e5e5e5", borderRadius: 4, marginBottom: 20 }}>
          <summary style={{ padding: "14px 18px", cursor: "pointer", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa" }}>
            Analysis Agents ({(agents.agents as any[]).length})
          </summary>
          <div style={{ padding: "0 18px 18px" }}>
            <div className="co-fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th className="fin-th-label">Agent</th><th className="fin-th-period">Scope</th><th className="fin-th-period">Writes Canon</th><th className="fin-th-label">Description</th></tr></thead>
                <tbody>
                  {(agents.agents as any[]).map((a: any) => (
                    <tr key={a.agent_key}>
                      <td className="fin-td-label" style={{ fontWeight: 500, fontSize: 14, color: "#111" }}>{a.display_name}</td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{a.scope?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="fin-td-value">{a.writes_canon ? <span style={{ fontSize: 10, fontWeight: 600, color: "#0D7A3E" }}>Yes</span> : <span style={{ fontSize: 10, color: "#ccc" }}>No</span>}</td>
                      <td style={{ padding: "8px 14px", fontSize: 13, color: "#666", lineHeight: 1.5, borderBottom: "1px solid #f3f3f3" }}>{a.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
