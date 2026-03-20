"use client";

import { useRouter } from "next/navigation";
import { useOperatorStatus } from "@/lib/hooks/use-operator";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusDot({ state }: { state: string }) {
  const color = state === "fresh" ? "#18A055" : state === "degraded" ? "#B08415" : "#D94040";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

function MetricCard({ title, value, sub, onClick }: { title: string; value: React.ReactNode; sub?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className="co-panel" style={{ cursor: onClick ? "pointer" : "default", textAlign: "left" } as any} onClick={onClick}>
      <div className="co-panel-title">{title}</div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </Tag>
  );
}

export function OperatorStatusApp() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useOperatorStatus();

  if (isLoading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed to load status: {error.message}</div>;
  if (!data) return null;

  const canon = data.canon ?? {};
  const bundle = data.bundle ?? {};
  const run = data.latest_workflow_run ?? {};
  const review = data.review_queue ?? {};
  const routing = data.routing ?? {};

  // New analysis sections
  const ca = data.company_analysis ?? {};
  const na = data.node_analysis ?? {};
  const newsTriage = ca.last_hour_news_triage ?? {};

  const state = canon.quality_state ?? "unknown";
  const bundleAge = canon.bundle_age_seconds != null ? `${Math.round(canon.bundle_age_seconds / 3600)}h` : "—";

  const SL = { fontSize: 11, fontWeight: 500 as const, textTransform: "uppercase" as const, letterSpacing: 0.3, color: "#aaa", marginBottom: 12 };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>System Status</h1>
        <button type="button" onClick={() => mutate()} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>Refresh</button>
      </div>

      {/* Health banner */}
      <div style={{
        padding: "16px 20px", borderRadius: 4, marginBottom: 20,
        background: state === "fresh" ? "#f0faf3" : state === "degraded" ? "#fffaf0" : "#fff5f5",
        border: `1px solid ${state === "fresh" ? "#c5e8d0" : state === "degraded" ? "#f1d48b" : "#f2b8b5"}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#111", display: "flex", alignItems: "center" }}>
            <StatusDot state={state} />
            {state === "fresh" ? "All Systems Healthy" : state === "degraded" ? "Degraded — Coverage Limited" : "System Issue"}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            Knowledge bundle is {bundleAge} old · Last sync {timeAgo(canon.last_successful_sync_time)} · Revision {data.knowledge_revision?.slice(-8)}
          </div>
        </div>
        {run.status && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: run.status === "failed" ? "#D94040" : run.status === "ok" || run.status === "completed" ? "#18A055" : "#888", fontWeight: 500 }}>
              Latest run: {run.status}
            </div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{run.workflow_key} · {timeAgo(run.completed_at)}</div>
          </div>
        )}
      </div>

      {/* ── Operator Queue Cards ──────────────────────── */}
      <div className="co-panel-grid" style={{ marginBottom: 20 }}>
        <MetricCard
          title="Review Queue"
          value={review.queue_count ?? 0}
          sub={`${review.decision_count ?? 0} decisions · Last review ${timeAgo(review.latest_reviewed_at)}`}
          onClick={() => router.push("/operator/reviews")}
        />
        <MetricCard
          title="Bottleneck Analyst"
          value={<>{na.binding_bottleneck_count ?? 0} <span style={{ fontSize: 14, color: "#aaa" }}>binding</span></>}
          sub={`${na.active_bottleneck_count ?? 0} active · Last assessed ${timeAgo(na.latest_assessed_at)}`}
          onClick={() => router.push("/operator/bottlenecks")}
        />
        <MetricCard
          title="Routing"
          value={<>{routing.open_count ?? 0} <span style={{ fontSize: 14, color: "#aaa" }}>open</span></>}
          sub={`${routing.entry_count ?? 0} total · ${routing.priority_counts?.high ?? 0} high priority`}
        />
        <MetricCard
          title="Company Analyst Targets"
          value={ca.company_analyst_target_count ?? 0}
          sub={`${ca.provider_refresh_target_count ?? 0} provider refresh · ${ca.company_universe_count ?? 0} universe`}
        />
        <MetricCard
          title="Coverage"
          value={ca.status_counts?.fresh ?? 0}
          sub={`${ca.status_counts?.coverage_limited ?? 0} limited · ${ca.status_counts?.awaiting_earnings ?? 0} awaiting earnings`}
        />
      </div>

      {/* ── Last Hour News Triage ─────────────────────── */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={SL}>Last Hour — News Triage Agent</div>
          <button type="button" onClick={() => router.push("/operator/activity")} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#0D7A3E", fontWeight: 500 }}>
            View full activity &rarr;
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)", color: "#111" }}>{newsTriage.tickers_with_high_signal_news ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>High-Signal News</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)", color: "#111" }}>{newsTriage.triaged_ticker_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Triaged</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)", color: newsTriage.rerun_recommended_count > 0 ? "#0D7A3E" : "#111" }}>{newsTriage.rerun_recommended_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Rerun Recommended</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)", color: newsTriage.forwarded_to_company_analyst_count > 0 ? "#0D7A3E" : "#111" }}>{newsTriage.forwarded_to_company_analyst_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Forwarded to Analyst</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)", color: "#888" }}>{newsTriage.already_reflected_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.3 }}>Already Reflected</div>
          </div>
        </div>
        {/* Currently triggered tickers */}
        {(ca.current_triggered_tickers ?? []).length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>Triggered for company analysis:</span>
            {ca.current_triggered_tickers.map((t: string) => (
              <span key={t} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#0D7A3E", padding: "2px 8px", background: "#f0f8f3", borderRadius: 2, border: "1px solid #d4e8da", fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Company Universe Breakdown ────────────────── */}
      {ca.status_counts && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 18, marginBottom: 20 }}>
          <div style={SL}>Company Universe — {ca.company_universe_count ?? 0} companies</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {Object.entries(ca.status_counts as Record<string, number>).map(([status, count]) => (
              <div key={status} style={{ padding: "10px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 3 }}>
                <div style={{ fontSize: 20, fontFamily: "var(--font-display)", color: "#111" }}>{count}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Details Grid ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Latest run */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 16 }}>
          <div style={SL}>Latest Workflow Run</div>
          <table className="co-data-table">
            <tbody>
              <tr><td className="co-dt-label">Workflow</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.workflow_key ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Status</td><td className="co-dt-value" style={{ textAlign: "left", color: run.status === "failed" ? "#D94040" : run.status === "ok" || run.status === "completed" ? "#18A055" : "#444" }}>{run.status ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Requested</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(run.requested_at)}</td></tr>
              <tr><td className="co-dt-label">Completed</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(run.completed_at)}</td></tr>
              <tr><td className="co-dt-label">Steps</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.step_count ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Requested By</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.requested_by ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Bundle */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 4, padding: 16 }}>
          <div style={SL}>Knowledge Bundle</div>
          <table className="co-data-table">
            <tbody>
              <tr><td className="co-dt-label">Version</td><td className="co-dt-value" style={{ textAlign: "left" }}>{bundle.bundle_version ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Created</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(bundle.created_at)}</td></tr>
              <tr><td className="co-dt-label">Age</td><td className="co-dt-value" style={{ textAlign: "left" }}>{bundleAge}</td></tr>
              <tr><td className="co-dt-label">Source Commit</td><td className="co-dt-value" style={{ textAlign: "left" }}>{bundle.source_commit ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Paths</td><td className="co-dt-value" style={{ textAlign: "left" }}>{bundle.included_paths?.length ?? 0} included</td></tr>
              <tr><td className="co-dt-label">Revision</td><td className="co-dt-value" style={{ textAlign: "left", fontFamily: "var(--font-data)", fontSize: 11, color: "#aaa" }}>{data.knowledge_revision ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
