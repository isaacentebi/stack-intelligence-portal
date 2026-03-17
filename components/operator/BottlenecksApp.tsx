"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BottleneckItem = {
  node_id: string;
  node_name: string;
  layer_id: number;
  layer_name?: string;
  status: string;
  severity: string;
  confidence: string;
  assessed_at: string | null;
  watch_tickers: string[];
  evidence_refs: string[];
  evidence_ref_count?: number;
  notes: string;
  pending_review_count?: number;
};

type BottlenecksResponse = {
  summary: {
    active_count: number;
    binding_count: number;
    by_status: Record<string, number>;
    by_severity: Record<string, number>;
    latest_assessed_at: string | null;
  };
  items: BottleneckItem[];
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  binding: { bg: "#fde8e8", color: "#991b1b" },
  easing: { bg: "#fef3cd", color: "#8c5b00" },
  not_binding: { bg: "#e6f4ea", color: "#065c2d" },
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: "#fde8e8", color: "#991b1b" },
  moderate: { bg: "#fef3cd", color: "#8c5b00" },
  low: { bg: "#f3f3f3", color: "#666" },
};

export function BottlenecksApp() {
  const router = useRouter();
  const [data, setData] = useState<BottlenecksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<any[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  function load() {
    setLoading(true);
    fetch("/api/operator/bottlenecks/active", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === "history" && decisions === null) {
      setHistLoading(true);
      fetch("/api/operator/bottlenecks/decisions", { cache: "no-store" })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setDecisions(d?.decisions ?? []))
        .catch(() => setDecisions([]))
        .finally(() => setHistLoading(false));
    }
  }, [tab, decisions]);

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>{error}</div>;
  if (!data) return null;

  const { active_count, binding_count, by_status, by_severity } = data.summary;
  const items = filter === "all" ? data.items : data.items.filter((i) => i.status === filter);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Bottlenecks</h1>
          <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>
            {active_count} assessments · {binding_count} binding · {by_severity?.critical ?? 0} critical · Last assessed {timeAgo(data.summary.latest_assessed_at)}
          </p>
        </div>
        <button type="button" onClick={load} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>Refresh</button>
      </div>

      {/* Pending reviews banner */}
      {data.items.some((i) => (i.pending_review_count ?? 0) > 0) && (
        <button type="button" onClick={() => router.push("/operator/reviews")} style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "10px 16px", marginBottom: 16, borderRadius: 3, boxSizing: "border-box",
          background: "#fef3cd", border: "1px solid #f1d48b", fontSize: 13, color: "#8c5b00",
        }}>
          <span><strong>{data.items.filter((i) => (i.pending_review_count ?? 0) > 0).length} bottleneck assessments</strong> pending review</span>
          <span style={{ fontSize: 12 }}>Review now →</span>
        </button>
      )}

      {/* Summary */}
      <div className="co-panel-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, 1fr)" }}>
        {["binding", "easing", "not_binding"].map((status) => {
          const count = by_status?.[status] ?? 0;
          const s = STATUS_STYLE[status] ?? { bg: "#f3f3f3", color: "#666" };
          return (
            <button key={status} type="button" className="co-panel" onClick={() => setFilter(filter === status ? "all" : status)} style={{ cursor: "pointer", textAlign: "center", border: filter === status ? `2px solid ${s.color}` : undefined }}>
              <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: s.color }}>{count}</div>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{humanize(status)}</div>
            </button>
          );
        })}
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#D94040" }}>{by_severity?.critical ?? 0}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Critical</div>
        </div>
        <div className="co-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "#111" }}>{active_count}</div>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
        <button type="button" onClick={() => setTab("active")} style={{ all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "active" ? 500 : 400, color: tab === "active" ? "#111" : "#999", borderBottom: tab === "active" ? "2px solid #0D7A3E" : "2px solid transparent" }}>
          Active ({items.length}{filter !== "all" ? ` ${humanize(filter)}` : ""})
        </button>
        <button type="button" onClick={() => setTab("history")} style={{ all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "history" ? 500 : 400, color: tab === "history" ? "#111" : "#999", borderBottom: tab === "history" ? "2px solid #0D7A3E" : "2px solid transparent" }}>
          Decisions {decisions ? `(${decisions.length})` : ""}
        </button>
      </div>

      {/* Active tab */}
      {tab === "active" && (
        <div className="co-fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">Node</th>
                <th className="fin-th-period">Layer</th>
                <th className="fin-th-period">Status</th>
                <th className="fin-th-period">Severity</th>
                <th className="fin-th-period">Confidence</th>
                <th className="fin-th-period">Watch</th>
                <th className="fin-th-period">Evidence</th>
                <th className="fin-th-period">Assessed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const expanded = expandedId === item.node_id;
                const ss = STATUS_STYLE[item.status] ?? { bg: "#f3f3f3", color: "#666" };
                const sv = SEVERITY_STYLE[item.severity] ?? { bg: "#f3f3f3", color: "#666" };

                return (
                  <React.Fragment key={item.node_id}>
                    <tr onClick={() => setExpandedId(expanded ? null : item.node_id)} style={{ cursor: "pointer", background: expanded ? "#fafafa" : undefined }}>
                      <td className="fin-td-label">
                        <div style={{ fontWeight: 500 }}>{item.node_name}</div>
                        <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#bbb" }}>{item.node_id}</div>
                      </td>
                      <td className="fin-td-value" style={{ fontSize: 12, color: "#888" }}>L{item.layer_id}</td>
                      <td className="fin-td-value">
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: ss.bg, color: ss.color }}>
                          {humanize(item.status)}
                        </span>
                      </td>
                      <td className="fin-td-value">
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: sv.bg, color: sv.color }}>
                          {humanize(item.severity)}
                        </span>
                      </td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{humanize(item.confidence)}</td>
                      <td className="fin-td-value">
                        {item.watch_tickers.length > 0 ? (
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {item.watch_tickers.slice(0, 4).map((t) => (
                              <button key={t} type="button" onClick={(e) => { e.stopPropagation(); router.push(`/operator/companies/${t}`); }}
                                style={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 10, color: "#0D7A3E", padding: "1px 4px", background: "#e6f4ea", borderRadius: 2 }}>{t}</button>
                            ))}
                            {item.watch_tickers.length > 4 && <span style={{ fontSize: 10, color: "#aaa" }}>+{item.watch_tickers.length - 4}</span>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="fin-td-value" style={{ fontSize: 12 }}>{item.evidence_ref_count ?? item.evidence_refs.length}</td>
                      <td className="fin-td-value" style={{ fontSize: 12, color: "#aaa" }}>{timeAgo(item.assessed_at)}</td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px 20px", background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                          {item.notes && <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: "0 0 10px" }}>{item.notes}</p>}
                          {item.evidence_refs.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {item.evidence_refs.map((ref, i) => (
                                <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "#f0f0f0", borderRadius: 2, color: "#666" }}>{ref}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ marginTop: 10 }}>
                            <button type="button" onClick={() => router.push(`/operator/world?layer=${item.layer_id}&node=${item.node_id}`)}
                              style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#0D7A3E", fontWeight: 500 }}>
                              View node →
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div>
          {histLoading && <div className="op-loading"><span className="op-spinner" /></div>}
          {!histLoading && (decisions ?? []).length === 0 && (
            <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>
              No bottleneck decisions recorded yet. Assessments now require approval — decisions will appear here after the next enrichment cycle.
            </div>
          )}
          {!histLoading && (decisions ?? []).length > 0 && (
            <div className="co-fin-table-wrap">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th className="fin-th-label">Node</th>
                    <th className="fin-th-period">Change</th>
                    <th className="fin-th-period">Decision</th>
                    <th className="fin-th-period">Reviewed By</th>
                    <th className="fin-th-period">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(decisions ?? []).map((d: any) => (
                    <tr key={d.entry_id} style={{ cursor: "pointer" }} onClick={() => router.push(`/operator/world?layer=${d.layer_id ?? ""}&node=${d.node_id}`)}>
                      <td className="fin-td-label">
                        <div style={{ fontWeight: 500 }}>{d.node_name ?? d.node_id}</div>
                        <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#bbb" }}>{d.node_id}</div>
                      </td>
                      <td className="fin-td-value">
                        <span style={{ ...(STATUS_STYLE[d.old_status] ? { color: STATUS_STYLE[d.old_status].color } : { color: "#666" }) }}>{humanize(d.old_status ?? "—")}</span>
                        <span style={{ margin: "0 6px", color: "#ccc" }}>→</span>
                        <span style={{ ...(STATUS_STYLE[d.new_status] ? { color: STATUS_STYLE[d.new_status].color } : { color: "#666" }), fontWeight: 500 }}>{humanize(d.new_status ?? "—")}</span>
                      </td>
                      <td className="fin-td-value">
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: d.decision === "accept" ? "#e6f4ea" : "#fde8e8", color: d.decision === "accept" ? "#065c2d" : "#991b1b" }}>
                          {d.decision === "accept" ? "Accepted" : "Rejected"}
                        </span>
                      </td>
                      <td className="fin-td-value fin-td-value--derived">{d.reviewed_by ?? "—"}</td>
                      <td className="fin-td-value">{d.reviewed_at ? new Date(d.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
