"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NodeChange = {
  node_id: string;
  node_name?: string;
  old_value?: { role?: string; relevance?: string; moat_in_node?: string[]; revenue_exposure?: string };
  new_value?: { role?: string; relevance?: string; moat_in_node?: string[]; revenue_exposure?: string };
  confidence?: string;
  notes?: string;
  evidence_refs?: string[];
};

type ReviewItem = {
  proposal_key: string;
  subject_key: string;
  subject_label: string;
  priority: string;
  confidence?: string;
  structured_rationale?: string;
  current_summary?: string;
  proposed_summary?: string;
  evidence_refs?: string[];
  impact_flags?: string[];
  retained_node_ids?: string[];
  proposed_value?: { nodes?: NodeChange[] };
  current_value?: { nodes?: { node_id: string; old_value?: any }[] };
  artifact_generated_at?: string | null;
  freshest_evidence_at?: string | null;
  latest_transcript_date_used?: string | null;
};

type ReviewQueueResponse = {
  summary: { queue_count?: number };
  items: ReviewItem[];
  recent_decisions: { count: number; latest_reviewed_at: string | null };
};

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ReviewQueueApp() {
  const router = useRouter();
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedHistKey, setExpandedHistKey] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ key: string; ok: boolean; message: string } | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pastDecisions, setPastDecisions] = useState<any[] | null>(null);
  const [histLoading, setPastDecisionsLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/operator/reviews/queue", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function loadDecisions() {
    setPastDecisionsLoading(true);
    fetch("/api/operator/reviews/decisions", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setPastDecisions(d?.decisions ?? []))
      .catch(() => setPastDecisions([]))
      .finally(() => setPastDecisionsLoading(false));
  }

  useEffect(() => {
    if (tab === "history" && pastDecisions === null) loadDecisions();
  }, [tab, pastDecisions]);

  async function handleAction(key: string, action: "accept" | "reject" | "dismiss") {
    setActing(key);
    setActionResult(null);
    try {
      const res = await fetch(`/api/operator/reviews/${encodeURIComponent(key)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_by: "portal:operator" }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setActionResult({ key, ok: true, message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed successfully` });
        load();
      } else {
        const detail = body?.detail ?? body?.error ?? `Failed (${res.status})`;
        const msg = typeof detail === "string" ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200);
        setActionResult({ key, ok: false, message: msg });
      }
    } catch (e) {
      setActionResult({ key, ok: false, message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setActing(null);
    }
  }

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed: {error}</div>;
  if (!data) return null;

  const items = data.items ?? [];
  const decisions = data.recent_decisions;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Reviews</h1>
          <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>
            {items.length} pending · {data.recent_decisions?.count ?? 0} decisions recorded
          </p>
        </div>
        <button type="button" onClick={() => { load(); if (tab === "history") { setPastDecisions(null); loadDecisions(); } }} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
        <button type="button" onClick={() => setTab("pending")} style={{
          all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "pending" ? 500 : 400,
          color: tab === "pending" ? "#111" : "#999", borderBottom: tab === "pending" ? "2px solid #0D7A3E" : "2px solid transparent",
        }}>
          Pending ({items.length})
        </button>
        <button type="button" onClick={() => setTab("history")} style={{
          all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "history" ? 500 : 400,
          color: tab === "history" ? "#111" : "#999", borderBottom: tab === "history" ? "2px solid #0D7A3E" : "2px solid transparent",
        }}>
          Past Decisions {pastDecisions ? `(${pastDecisions.filter((d: any) => d.proposed_value?.nodes?.length > 0 || d.summary).length})` : ""}
        </button>
      </div>

      {/* History tab */}
      {tab === "history" && (
        <div>
          {histLoading && <div className="op-loading"><span className="op-spinner" /></div>}
          {!histLoading && (pastDecisions ?? []).length === 0 && (
            <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>No past decisions.</div>
          )}
          {!histLoading && (pastDecisions ?? []).length > 0 && (
            <div className="co-fin-table-wrap">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th className="fin-th-label">Subject</th>
                    <th className="fin-th-period">Type</th>
                    <th className="fin-th-period">Decision</th>
                    <th className="fin-th-period">Nodes</th>
                    <th className="fin-th-period">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(pastDecisions ?? []).filter((d: any) => d.proposed_value?.nodes?.length > 0 || d.summary).map((d: any) => {
                    const et = d.entity_type ?? "";
                    const isCompany = et.includes("company");
                    const nodeIds = (d.node_ids ?? []).length > 0 ? d.node_ids : (isCompany ? [] : [d.subject_key]);
                    const label = d.subject_label || d.subject_key || "—";
                    const rowKey = d.entry_id ?? d.proposal_key;

                    const isExpanded = expandedHistKey === rowKey;
                    const histNodes: NodeChange[] = d.proposed_value?.nodes ?? [];

                    return (
                    <React.Fragment key={rowKey}>
                    <tr onClick={() => setExpandedHistKey(isExpanded ? null : rowKey)} style={{ cursor: "pointer", background: isExpanded ? "#fafafa" : undefined }}>
                      <td className="fin-td-label fin-td-label--bold">{label}</td>
                      <td className="fin-td-value">
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 2, background: isCompany ? "#e8f0fe" : "#f3f3f3", color: isCompany ? "#0b5ea8" : "#888" }}>
                          {isCompany ? "Company" : "Node"}
                        </span>
                      </td>
                      <td className="fin-td-value">
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3,
                          background: d.decision === "accept" ? "#e6f4ea" : d.decision === "reject" ? "#fde8e8" : "#f3f3f3",
                          color: d.decision === "accept" ? "#065c2d" : d.decision === "reject" ? "#991b1b" : "#666",
                        }}>
                          {d.decision === "accept" ? "Accepted" : d.decision === "reject" ? "Rejected" : humanize(d.decision ?? "unknown")}
                        </span>
                      </td>
                      <td className="fin-td-value">{nodeIds.join(", ") || "—"}</td>
                      <td className="fin-td-value">{d.reviewed_at ? new Date(d.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} style={{ padding: "16px 20px", background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                          {/* Node diffs */}
                          {histNodes.map((nc) => (
                            <div key={nc.node_id} style={{ marginBottom: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#0D7A3E", fontWeight: 500 }}>{nc.node_id}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{nc.node_name ?? ""}</span>
                              </div>
                              {(nc.old_value?.role || nc.new_value?.role) && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#D94040", marginBottom: 4 }}>Current</div>
                                    <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, padding: 10, background: "#fff5f5", border: "1px solid #fde8e8", borderRadius: 3 }}>
                                      {nc.old_value?.role ?? "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#18A055", marginBottom: 4 }}>Proposed</div>
                                    <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, padding: 10, background: "#f0faf3", border: "1px solid #c5e8d0", borderRadius: 3 }}>
                                      {nc.new_value?.role ?? "—"}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Empty state */}
                          {histNodes.length === 0 && !d.summary && (
                            <div style={{ fontSize: 13, color: "#bbb", fontStyle: "italic" }}>No detail recorded for this decision (pre-enrichment).</div>
                          )}
                          {/* Summary */}
                          {d.summary && <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: histNodes.length > 0 ? "8px 0 0" : 0 }}>{d.summary}</p>}
                          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#aaa" }}>
                            {d.artifact_generated_at && <span>Generated: {new Date(d.artifact_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                            {d.priority && <span>Priority: {humanize(d.priority)}</span>}
                            {d.merge_executed != null && (
                              <span style={{ color: d.merge_exit_code === 0 ? "#18A055" : "#D94040" }}>
                                Merge: {d.merge_exit_code === 0 ? "Success" : "Failed"}
                              </span>
                            )}
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
        </div>
      )}

      {/* Pending tab */}
      {tab === "pending" && items.length === 0 && (
        <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>
          No pending reviews. All company judgments are up to date.
          {data.recent_decisions?.count ? <div style={{ marginTop: 8, fontSize: 12 }}>{data.recent_decisions.count} decisions recorded · Last review {timeAgo(data.recent_decisions.latest_reviewed_at)}</div> : null}
        </div>
      )}

      {tab === "pending" && items.map((item) => {
        const expanded = expandedKey === item.proposal_key;
        const nodes = item.proposed_value?.nodes ?? [];
        const isActing = acting === item.proposal_key;

        return (
          <div key={item.proposal_key} style={{ border: "1px solid #e5e5e5", marginBottom: 12, background: "#fff" }}>
            {/* Header — always visible */}
            <button
              type="button"
              onClick={() => setExpandedKey(expanded ? null : item.proposal_key)}
              style={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "14px 20px", boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#0D7A3E", fontWeight: 500 }}>
                  {item.subject_key}
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{item.subject_label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3,
                  background: item.priority === "high" ? "#fde8e8" : item.priority === "low" ? "#f3f3f3" : "#fef3cd",
                  color: item.priority === "high" ? "#991b1b" : item.priority === "low" ? "#666" : "#8c5b00",
                }}>{humanize(item.priority)}</span>
                {(item.impact_flags ?? []).includes("core_company") && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 3, background: "#e8f0fe", color: "#0b5ea8" }}>Core</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>{nodes.length} node{nodes.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 11, color: "#ccc", fontFamily: "var(--font-data)" }}>{timeAgo(item.artifact_generated_at)}</span>
                <span style={{ fontSize: 16, color: "#ccc" }}>{expanded ? "−" : "+"}</span>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                {/* Context bar */}
                <div style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#999" }}>
                  {item.artifact_generated_at && <span>Generated: {new Date(item.artifact_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                  {item.freshest_evidence_at && <span>Latest evidence: {new Date(item.freshest_evidence_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                  {item.latest_transcript_date_used && <span>Transcript: {item.latest_transcript_date_used}</span>}
                  {item.confidence && <span>Confidence: <strong style={{ color: item.confidence === "high" ? "#18A055" : "#888" }}>{humanize(item.confidence)}</strong></span>}
                </div>

                {/* Rationale */}
                {item.structured_rationale && (
                  <div style={{ padding: "14px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa", marginBottom: 6 }}>AI Rationale</div>
                    <p style={{ fontSize: 14, color: "#333", lineHeight: 1.7, margin: 0 }}>{item.structured_rationale}</p>
                  </div>
                )}

                {/* Node changes */}
                {nodes.map((nc) => (
                  <div key={nc.node_id} style={{ padding: "14px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#0D7A3E", fontWeight: 500 }}>{nc.node_id}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{nc.node_name ?? ""}</span>
                    </div>

                    {/* Role diff */}
                    {(nc.old_value?.role || nc.new_value?.role) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#D94040", marginBottom: 4 }}>Current Role</div>
                          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, padding: 10, background: "#fff5f5", border: "1px solid #fde8e8", borderRadius: 3 }}>
                            {nc.old_value?.role ?? "—"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#18A055", marginBottom: 4 }}>Proposed Role</div>
                          <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, padding: 10, background: "#f0faf3", border: "1px solid #c5e8d0", borderRadius: 3 }}>
                            {nc.new_value?.role ?? "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other changes */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
                      {nc.old_value?.relevance !== nc.new_value?.relevance && nc.new_value?.relevance && (
                        <span>Relevance: <span style={{ color: "#aaa" }}>{humanize(nc.old_value?.relevance ?? "—")}</span> → <strong>{humanize(nc.new_value.relevance)}</strong></span>
                      )}
                      {nc.old_value?.revenue_exposure !== nc.new_value?.revenue_exposure && nc.new_value?.revenue_exposure && (
                        <span>Revenue: <span style={{ color: "#aaa" }}>{humanize(nc.old_value?.revenue_exposure ?? "—")}</span> → <strong>{humanize(nc.new_value.revenue_exposure)}</strong></span>
                      )}
                      {nc.confidence && <span style={{ color: "#888" }}>Confidence: {humanize(nc.confidence)}</span>}
                    </div>

                    {/* Evidence */}
                    {(nc.evidence_refs?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {nc.evidence_refs!.map((ref, i) => (
                          <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "#f3f3f3", borderRadius: 2, color: "#666" }}>{ref}</span>
                        ))}
                      </div>
                    )}

                    {nc.notes && <p style={{ fontSize: 13, color: "#888", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>{nc.notes}</p>}
                  </div>
                ))}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
                  {isActing && <span className="op-spinner" style={{ marginRight: 8 }} />}
                  <button
                    type="button"
                    disabled={!!acting}
                    onClick={() => handleAction(item.proposal_key, "dismiss")}
                    className="fin-btn"
                    style={{ color: "#888", opacity: acting ? 0.4 : 1 }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={!!acting}
                    onClick={() => handleAction(item.proposal_key, "reject")}
                    className="fin-btn"
                    style={{ background: "#fff5f5", color: "#D94040", border: "1px solid #fde8e8", opacity: acting ? 0.4 : 1 }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={!!acting}
                    onClick={() => handleAction(item.proposal_key, "accept")}
                    className="fin-btn fin-btn--on"
                    style={{ padding: "6px 20px", opacity: acting ? 0.4 : 1 }}
                  >
                    Accept
                  </button>
                </div>

                {/* Action result feedback */}
                {actionResult?.key === item.proposal_key && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 3, fontSize: 13,
                    background: actionResult.ok ? "#f0faf3" : "#fff5f5",
                    border: `1px solid ${actionResult.ok ? "#c5e8d0" : "#f2b8b5"}`,
                    color: actionResult.ok ? "#065c2d" : "#991b1b",
                  }}>
                    {actionResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
