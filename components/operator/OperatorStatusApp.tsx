"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StatusData = Record<string, any>;

function timeAgo(iso: string | null): string {
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

export function OperatorStatusApp() {
  const router = useRouter();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/operator/status", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed to load status: {error}</div>;
  if (!data) return null;

  const canon = data.canon ?? {};
  const bundle = data.bundle ?? {};
  const run = data.latest_workflow_run ?? {};
  const queues = data.refresh_queues ?? {};
  const review = data.review_queue ?? {};
  const bn = data.bottlenecks ?? {};
  const routing = data.routing ?? {};

  const state = canon.quality_state ?? "unknown";
  const bundleAge = canon.bundle_age_seconds != null ? `${Math.round(canon.bundle_age_seconds / 3600)}h` : "—";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>System Status</h1>
        <button type="button" onClick={load} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>
          Refresh
        </button>
      </div>

      {/* Health banner */}
      <div style={{
        padding: "16px 20px",
        borderRadius: 4,
        marginBottom: 20,
        background: state === "fresh" ? "#f0faf3" : state === "degraded" ? "#fffaf0" : "#fff5f5",
        border: `1px solid ${state === "fresh" ? "#c5e8d0" : state === "degraded" ? "#f1d48b" : "#f2b8b5"}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
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
            <div style={{ fontSize: 12, color: run.status === "failed" ? "#D94040" : run.status === "completed" ? "#18A055" : "#888", fontWeight: 500 }}>
              Latest run: {run.status}
            </div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{run.workflow_key} · {timeAgo(run.completed_at)}</div>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div className="co-panel-grid" style={{ marginBottom: 20 }}>
        <button type="button" className="co-panel" style={{ cursor: "pointer", textAlign: "left" }} onClick={() => router.push("/operator/reviews")}>
          <div className="co-panel-title">Review Queue</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{review.queue_count ?? 0}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {review.decision_count ?? 0} decisions · Last review {timeAgo(review.latest_reviewed_at)}
          </div>
        </button>

        <button type="button" className="co-panel" style={{ cursor: "pointer", textAlign: "left" }} onClick={() => router.push("/operator/bottlenecks")}>
          <div className="co-panel-title">Bottlenecks</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>
            {bn.binding_count ?? 0} <span style={{ fontSize: 14, color: "#aaa" }}>binding</span>
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {bn.active_count ?? 0} active · Last assessed {timeAgo(bn.latest_assessed_at)}
          </div>
        </button>

        <button type="button" className="co-panel" style={{ cursor: "pointer", textAlign: "left" }} onClick={() => router.push("/operator/routing")}>
          <div className="co-panel-title">Routing</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>
            {routing.open_count ?? 0} <span style={{ fontSize: 14, color: "#aaa" }}>open</span>
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {routing.entry_count ?? 0} total · {routing.priority_counts?.high ?? 0} high priority
          </div>
        </button>

        <div className="co-panel">
          <div className="co-panel-title">Refresh Queue</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>
            {queues.refresh_queue?.queue_count ?? 0}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
            {queues.event_queue?.queue_count ?? 0} events · {queues.node_watch_queue?.queue_count ?? 0} node watches
          </div>
        </div>

        <div className="co-panel">
          <div className="co-panel-title">Coverage</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>
            {canon.quality_details?.coverage_limited_count ?? 0}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>companies with limited coverage</div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Latest run */}
        <div style={{ border: "1px solid #e5e5e5", padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa", marginBottom: 10 }}>Latest Workflow Run</div>
          <table className="co-data-table">
            <tbody>
              <tr><td className="co-dt-label">Workflow</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.workflow_key ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Status</td><td className="co-dt-value" style={{ textAlign: "left", color: run.status === "failed" ? "#D94040" : run.status === "completed" ? "#18A055" : "#444" }}>{run.status ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Requested</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(run.requested_at)}</td></tr>
              <tr><td className="co-dt-label">Completed</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(run.completed_at)}</td></tr>
              <tr><td className="co-dt-label">Steps</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.step_count ?? "—"}</td></tr>
              <tr><td className="co-dt-label">Requested By</td><td className="co-dt-value" style={{ textAlign: "left" }}>{run.requested_by ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Bundle */}
        <div style={{ border: "1px solid #e5e5e5", padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa", marginBottom: 10 }}>Knowledge Bundle</div>
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
