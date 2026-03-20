"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useReviewQueue, useReviewDecisions, useAcceptedChanges } from "@/lib/hooks/use-operator";

/* ── Types ──────────────────────────────────────────────── */

type NodeChange = {
  node_id: string;
  node_name?: string;
  old_value?: { role?: string; relevance?: string; moat_in_node?: string[]; revenue_exposure?: string };
  new_value?: { role?: string; relevance?: string; moat_in_node?: string[]; revenue_exposure?: string };
  confidence?: string;
  notes?: string;
  evidence_refs?: string[];
  impact_flags?: string[];
};

type ReviewItem = {
  proposal_key: string;
  entity_type: string;
  entity_label?: string;
  subject_key: string;
  subject_label: string;
  priority: string;
  confidence?: string;
  merge_mode?: string;
  structured_rationale?: string;
  current_summary?: string;
  proposed_summary?: string;
  evidence_refs?: string[];
  impact_flags?: string[];
  retained_node_ids?: string[];
  proposed_value?: { nodes?: NodeChange[]; status?: string; severity?: string; confidence?: string; notes?: string; watch_tickers?: string[]; evidence_refs?: string[] };
  current_value?: { nodes?: any[]; status?: string; severity?: string; confidence?: string; notes?: string; watch_tickers?: string[]; evidence_refs?: string[] };
  action_preview?: {
    summary?: string;
    current_node_ids?: string[];
    addition_node_ids?: string[];
    removal_node_ids?: string[];
    retained_node_ids?: string[];
    resulting_node_ids?: string[];
    ambiguity_node_ids?: string[];
  };
  explain_summary?: string;
  resulting_node_ids?: string[];
  artifact_generated_at?: string | null;
  freshest_evidence_at?: string | null;
  latest_transcript_date_used?: string | null;
  review_reason?: string;
  merge_notes?: string;
};

type ReviewQueueResponse = {
  summary: {
    queue_count?: number;
    by_entity_type?: Record<string, number>;
    by_priority?: Record<string, number>;
    by_merge_mode?: Record<string, number>;
  };
  items: ReviewItem[];
  recent_decisions?: { count: number; latest_reviewed_at: string | null };
};

type Decision = {
  entry_id: string;
  proposal_key: string | null;
  entity_type: string;
  subject_key: string;
  subject_label: string;
  decision: string;
  reviewed_by: string;
  reviewed_at: string;
  node_ids?: string[];
  summary?: string;
  priority?: string;
  merge_mode?: string;
  merge_executed?: boolean;
  merge_exit_code?: number;
  artifact_generated_at?: string;
  proposed_value?: any;
  current_value?: any;
  /* extended fields — available when include_values=true */
  confidence?: string;
  structured_rationale?: string;
  evidence_refs?: string[];
  impact_flags?: string[];
  trigger_reasons?: string[];
  action_preview?: {
    summary?: string;
    current_node_ids?: string[];
    addition_node_ids?: string[];
    removal_node_ids?: string[];
    retained_node_ids?: string[];
    resulting_node_ids?: string[];
    ambiguity_node_ids?: string[];
  };
  explain_summary?: string;
  freshest_evidence_at?: string;
  latest_transcript_date_used?: string;
  proposed_summary?: string;
  retained_node_ids?: string[];
  decision_source?: string;
  decision_type?: string;
};

/* ── Accepted-changes types (richer source for company auto-merges) ── */

type FieldDiff = {
  node_id: string;
  node_name?: string;
  // New shape from engine: changes dict keyed by field name
  changes?: Record<string, { old?: string | null; new?: string | null }>;
  structural_fields?: string[];
  metadata_fields?: string[];
  // Legacy flat shape (kept for compat)
  field?: string;
  before?: string | null;
  after?: string | null;
};

type AcceptedChange = {
  change_id: string;
  entity_type: string;
  subject_key: string;
  subject_label?: string;
  decision_type: string;           // "auto_merge" | "reaffirmation"
  trigger_reasons: string[];
  field_diffs?: FieldDiff[] | null;
  before_snapshot?: any;
  after_snapshot?: any;
  summary?: string;
  published_at: string;
  knowledge_revision?: number;
  source_commit?: string;
  run_id?: string;
  node_ids?: string[];
  evidence_refs?: string[];
  workflow_run_id?: string;
  workflow_key?: string;
  workflow_step?: string;
  artifact_bundle?: Record<string, any>;
  company_run_record?: { path?: string; decision_mode?: string };
  decision_mode?: string;
  rerun_explanation?: Record<string, any>;
  evidence_used?: Record<string, any>;
  recency_state?: Record<string, any>;
  policy_state?: Record<string, any>;
};

/* ── Helpers ────────────────────────────────────────────── */

const ACRONYMS: Record<string, string> = { Ip: "IP", Ai: "AI", Gpu: "GPU", Cpu: "CPU", Api: "API", Sdk: "SDK", Hbm: "HBM", Tsmc: "TSMC" };

function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b\w+/g, (w) => ACRONYMS[w] ?? w);
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function acceptedChangeExplanation(ac: AcceptedChange): string | null {
  const explanation = ac.rerun_explanation ?? {};
  const recency = ac.recency_state ?? {};
  const policy = ac.policy_state ?? {};
  const source = explanation.trigger_source ? humanize(explanation.trigger_source) : null;
  const trigger = explanation.raw_trigger_reason ? humanize(explanation.raw_trigger_reason) : null;
  const latestFinancial = explanation.latest_financial_period ?? recency.latest_financial_period;
  const latestTranscript = explanation.latest_transcript_period ?? recency.latest_local_transcript_period;
  const mode = policy.mode ? humanize(policy.mode) : (ac.decision_mode ? humanize(ac.decision_mode) : null);
  const parts = [
    source ? `Source: ${source}` : null,
    trigger ? `reason ${trigger}` : null,
    latestFinancial ? `financials ${latestFinancial}` : null,
    latestTranscript ? `latest transcript ${latestTranscript}` : null,
    recency.transcript_alignment ? `alignment ${humanize(recency.transcript_alignment)}` : null,
    mode ? `mode ${mode}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : null;
}

function reviewerLabel(s: string): { label: string; style: React.CSSProperties } {
  if (s === "system:auto_merge") return { label: "System (auto)", style: { color: "#888", fontStyle: "italic" } };
  if (s === "system:duplicate_cleanup") return { label: "System (dedup)", style: { color: "#888", fontStyle: "italic" } };
  if (s === "operator:bulk_accept") return { label: "Bulk Accept", style: { color: "#0B5EA8" } };
  if (s === "portal:operator") return { label: "Operator", style: { color: "#0D7A3E", fontWeight: 500 } };
  if (s.startsWith("system:")) return { label: `System (${s.slice(7).replace(/_/g, " ")})`, style: { color: "#888", fontStyle: "italic" } };
  return { label: s, style: { color: "#444" } };
}

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#fde8e8", fg: "#991b1b" },
  high: { bg: "#fde8e8", fg: "#991b1b" },
  medium: { bg: "#fef3cd", fg: "#8c5b00" },
  low: { bg: "#f3f3f3", fg: "#666" },
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  binding: { bg: "#fde8e8", fg: "#991b1b" },
  easing: { bg: "#fef3cd", fg: "#8c5b00" },
  not_binding: { bg: "#e6f4ea", fg: "#065c2d" },
};

/* ── Field diff badge ───────────────────────────────────── */

function DiffBadge({ label, from, to }: { label: string; from?: string; to?: string }) {
  if (!from && !to) return null;
  const changed = from !== to;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginRight: 16, marginBottom: 4 }}>
      <span style={{ color: "#888", fontWeight: 500 }}>{label}:</span>
      {changed ? (
        <>
          <span style={{ color: "#999", textDecoration: "line-through" }}>{humanize(from ?? "—")}</span>
          <span style={{ color: "#888" }}>&rarr;</span>
          <span style={{ color: "#111", fontWeight: 500 }}>{humanize(to ?? "—")}</span>
        </>
      ) : (
        <span style={{ color: "#666" }}>{humanize(to ?? from ?? "—")}</span>
      )}
    </div>
  );
}

/* ── Moat diff ──────────────────────────────────────────── */

function MoatDiff({ oldMoats, newMoats }: { oldMoats?: string[]; newMoats?: string[] }) {
  const old = new Set(oldMoats ?? []);
  const next = new Set(newMoats ?? []);
  const added = [...next].filter((m) => !old.has(m));
  const removed = [...old].filter((m) => !next.has(m));
  const kept = [...next].filter((m) => old.has(m));
  if (added.length === 0 && removed.length === 0 && kept.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
      {kept.map((m) => (
        <span key={m} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 2, border: "1px solid #e0e0e0", color: "#666", background: "#fafafa" }}>{humanize(m)}</span>
      ))}
      {added.map((m) => (
        <span key={m} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 2, border: "1px solid #c5e8d0", color: "#065c2d", background: "#f0faf3", fontWeight: 500 }}>+ {humanize(m)}</span>
      ))}
      {removed.map((m) => (
        <span key={m} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 2, border: "1px solid #f2b8b5", color: "#991b1b", background: "#fff5f5", textDecoration: "line-through" }}>{humanize(m)}</span>
      ))}
    </div>
  );
}

/* ── Bottleneck diff section ────────────────────────────── */

function BottleneckDiff({ current, proposed }: { current: any; proposed: any }) {
  const p = proposed ?? {};
  const isFirstTime = current == null;
  const c = current ?? {};

  const ss = STATUS_STYLE[p.status] ?? { bg: "#f3f3f3", fg: "#666" };
  const confColor = p.confidence === "high" ? "#18A055" : p.confidence === "medium" ? "#8c5b00" : "#D94040";

  return (
    <div>
      {/* First-time assessment */}
      {isFirstTime && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 2, background: "#e8f0fe", color: "#0b5ea8", marginBottom: 10, display: "inline-block" }}>New Assessment</span>
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#888", fontWeight: 500 }}>Status:</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: ss.bg, color: ss.fg }}>{humanize(p.status ?? "—")}</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#888", fontWeight: 500 }}>Severity:</span>
              <span style={{ fontWeight: 500, color: "#111" }}>{humanize(p.severity ?? "—")}</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#888", fontWeight: 500 }}>Confidence:</span>
              <span style={{ fontWeight: 500, color: confColor }}>{humanize(p.confidence ?? "—")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Change diff */}
      {!isFirstTime && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {c.status !== p.status && <DiffBadge label="Status" from={c.status} to={p.status} />}
          {c.severity !== p.severity && <DiffBadge label="Severity" from={c.severity} to={p.severity} />}
          {c.confidence !== p.confidence && <DiffBadge label="Confidence" from={c.confidence} to={p.confidence} />}
          {c.status === p.status && c.severity === p.severity && c.confidence === p.confidence && (
            <span style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>No structural change — notes updated</span>
          )}
        </div>
      )}

      {/* Watch tickers */}
      {(p.watch_tickers ?? []).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6 }}>Watch Tickers</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {p.watch_tickers.map((t: string) => (
              <span key={t} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#0D7A3E", padding: "2px 8px", background: "#f0f8f3", borderRadius: 2, border: "1px solid #d4e8da" }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI notes */}
      {p.notes && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 6 }}>Assessment Notes</div>
          <p style={{ fontSize: 14, color: "#333", lineHeight: 1.7, margin: 0, padding: "12px 14px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4 }}>{p.notes}</p>
        </div>
      )}

      {/* Evidence */}
      {(p.evidence_refs ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {p.evidence_refs.map((ref: string, i: number) => (
            <EvidenceTag key={i} value={ref} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compute change summary for a node ──────────────────── */

function computeChangeSummary(nc: NodeChange): string[] {
  const diffs: string[] = [];
  if (nc.old_value?.relevance !== nc.new_value?.relevance) {
    diffs.push(`Relevance: ${humanize(nc.old_value?.relevance ?? "—")} → ${humanize(nc.new_value?.relevance ?? "—")}`);
  }
  if (nc.old_value?.revenue_exposure !== nc.new_value?.revenue_exposure) {
    diffs.push(`Revenue Exposure: ${humanize(nc.old_value?.revenue_exposure ?? "—")} → ${humanize(nc.new_value?.revenue_exposure ?? "—")}`);
  }
  const oldMoats = new Set(nc.old_value?.moat_in_node ?? []);
  const newMoats = new Set(nc.new_value?.moat_in_node ?? []);
  const added = [...newMoats].filter((m) => !oldMoats.has(m));
  const removed = [...oldMoats].filter((m) => !newMoats.has(m));
  if (added.length > 0) diffs.push(`Moat: added ${added.map(humanize).join(", ")}`);
  if (removed.length > 0) diffs.push(`Moat: removed ${removed.map(humanize).join(", ")}`);
  return diffs;
}

/* ── Format evidence ref for display ────────────────────── */

function formatEvidenceRef(ref: string): { label: string; tooltip: string } {
  const colonIdx = ref.indexOf(":");
  if (colonIdx === -1) return { label: humanize(ref), tooltip: ref };
  const prefix = ref.slice(0, colonIdx);
  const rest = ref.slice(colonIdx + 1);

  switch (prefix) {
    case "transcript": {
      // transcript:MU:Q4_FY2025 or transcript:Q4_FY2025 or transcript:2317.TW:Q2_FY2025_earnings_call_facts_...
      const parts = rest.split(":");
      if (parts.length >= 2) {
        // ticker:period_and_maybe_more — extract just the period (e.g. Q4_FY2025)
        const periodMatch = parts[1].match(/^(Q\d_FY\d{4})/);
        const period = periodMatch ? periodMatch[1].replace(/_/g, " ") : parts[1].replace(/_/g, " ");
        return { label: `${parts[0]} ${period}`, tooltip: ref };
      }
      const periodMatch = rest.match(/^(Q\d_FY\d{4})/);
      const period = periodMatch ? periodMatch[1].replace(/_/g, " ") : rest.replace(/_/g, " ");
      return { label: `${period} Transcript`, tooltip: ref };
    }
    case "web": {
      // web:semiconductor.samsung.com/datacenter-ssd → samsung.com
      // web:eaton_800vdc_architecture → Eaton 800vdc Architecture (slug, no dots)
      // web:asm:interim_2026-03-11 → asm (interim)
      const webParts = rest.split(":");
      if (webParts.length >= 2) {
        // web:asm:interim_2026-03-11
        return { label: webParts[0], tooltip: ref };
      }
      const slashIdx = rest.indexOf("/");
      const host = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
      if (host.includes(".")) {
        // Real domain
        const domParts = host.split(".");
        const domain = domParts.length >= 2 ? domParts.slice(-2).join(".") : host;
        return { label: domain, tooltip: rest };
      }
      // Slug — humanize it but keep it short
      const slug = rest.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { label: slug.length > 30 ? slug.slice(0, 28) + "..." : slug, tooltip: ref };
    }
    case "signal":
      return { label: `Signal ${rest.replace("SIG-", "")}`, tooltip: ref };
    case "packet": {
      // packet:company_updates:MU → News: MU
      // packet:bottleneck_profile:2.5 → Bottleneck 2.5
      const pparts = rest.split(":");
      if (pparts.length >= 2 && pparts[0] === "company_updates") return { label: `News: ${pparts[1]}`, tooltip: ref };
      if (pparts.length >= 2 && pparts[0] === "bottleneck_profile") return { label: `Bottleneck ${pparts[1]}`, tooltip: ref };
      return { label: humanize(rest), tooltip: ref };
    }
    case "updates": {
      // updates:PR_2026-03-16_Eaton_NVIDIA_BeamRubinDSX → Press Release (Eaton, NVIDIA)
      const prMatch = rest.match(/^PR_\d{4}-\d{2}-\d{2}_(.+)/);
      if (prMatch) {
        const names = prMatch[1].split("_").slice(0, 3).join(", ");
        return { label: `PR: ${names}`, tooltip: ref };
      }
      return { label: humanize(rest), tooltip: ref };
    }
    case "segments":
      return { label: "Segment Data", tooltip: ref };
    default:
      return { label: humanize(ref), tooltip: ref };
  }
}

function EvidenceTag({ value }: { value: string }) {
  const { label, tooltip } = formatEvidenceRef(value);
  return (
    <span title={tooltip} style={{ fontSize: 11, padding: "2px 7px", background: "#f0f0f0", borderRadius: 2, color: "#666", cursor: "default" }}>{label}</span>
  );
}

function hasMaterialChange(nc: NodeChange): boolean {
  return computeChangeSummary(nc).length > 0;
}

/* ── Company node changes section ───────────────────────── */

function CompanyNodeChanges({ nodes }: { nodes: NodeChange[] }) {
  const [showRoleIdx, setShowRoleIdx] = useState<Record<number, boolean>>({});

  const materialNodes = nodes.filter(hasMaterialChange);
  const reaffirmedNodes = nodes.filter((n) => !hasMaterialChange(n));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Material changes first */}
      {materialNodes.map((nc, idx) => {
        const diffs = computeChangeSummary(nc);
        const relChanged = nc.old_value?.relevance !== nc.new_value?.relevance;
        const revChanged = nc.old_value?.revenue_exposure !== nc.new_value?.revenue_exposure;
        const moatChanged = JSON.stringify([...(nc.old_value?.moat_in_node ?? [])].sort()) !== JSON.stringify([...(nc.new_value?.moat_in_node ?? [])].sort());
        const roleChanged = nc.old_value?.role !== nc.new_value?.role;
        const showRole = !!showRoleIdx[idx];
        const confColor = nc.confidence === "high" ? "#18A055" : nc.confidence === "medium" ? "#8c5b00" : "#D94040";
        const confBg = nc.confidence === "high" ? "#f0faf3" : nc.confidence === "medium" ? "#fffcf5" : "#fff5f5";

        return (
          <div key={nc.node_id} style={{ padding: "16px 18px", border: "1px solid #e0e0e0", borderRadius: 4, background: "#fff" }}>
            {/* Header: node + confidence */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 15, color: "#0D7A3E", fontWeight: 600 }}>{nc.node_id}</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{nc.node_name ?? ""}</span>
              {nc.confidence && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 2, background: confBg, color: confColor }}>
                  {humanize(nc.confidence)}
                </span>
              )}
            </div>

            {/* Field diffs — inline rows */}
            <div style={{ marginBottom: 10 }}>
              {relChanged && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <span style={{ fontSize: 13, color: "#888", fontWeight: 500, minWidth: 130 }}>Relevance</span>
                  <span style={{ fontSize: 13, color: "#999", textDecoration: "line-through" }}>{humanize(nc.old_value?.relevance ?? "—")}</span>
                  <span style={{ fontSize: 12, color: "#bbb" }}>&rarr;</span>
                  <span style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{humanize(nc.new_value?.relevance ?? "—")}</span>
                </div>
              )}
              {revChanged && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <span style={{ fontSize: 13, color: "#888", fontWeight: 500, minWidth: 130 }}>Revenue Exposure</span>
                  <span style={{ fontSize: 13, color: "#999", textDecoration: "line-through" }}>{humanize(nc.old_value?.revenue_exposure ?? "—")}</span>
                  <span style={{ fontSize: 12, color: "#bbb" }}>&rarr;</span>
                  <span style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{humanize(nc.new_value?.revenue_exposure ?? "—")}</span>
                </div>
              )}
              {moatChanged && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <span style={{ fontSize: 13, color: "#888", fontWeight: 500, minWidth: 130 }}>Moats</span>
                  <MoatDiff oldMoats={nc.old_value?.moat_in_node} newMoats={nc.new_value?.moat_in_node} />
                </div>
              )}
            </div>

            {/* Notes — the WHY */}
            {nc.notes && (
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.6, borderLeft: "2px solid #ddd", paddingLeft: 12 }}>{nc.notes}</p>
            )}

            {/* Evidence */}
            {(nc.evidence_refs?.length ?? 0) > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: roleChanged ? 10 : 0 }}>
                {nc.evidence_refs!.map((ref, i) => (
                  <EvidenceTag key={i} value={ref} />
                ))}
              </div>
            )}

            {/* Role diff — collapsed by default */}
            {roleChanged && (
              <div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowRoleIdx((p) => ({ ...p, [idx]: !p[idx] })); }}
                  style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, transition: "transform 0.15s", transform: showRole ? "rotate(90deg)" : "rotate(0deg)" }}>&#9654;</span>
                  Role text changed
                </button>
                {showRole && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#D94040", marginBottom: 4 }}>Current</div>
                      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, padding: 10, background: "#fff5f5", border: "1px solid #fde8e8", borderRadius: 3 }}>{nc.old_value?.role ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#18A055", marginBottom: 4 }}>Proposed</div>
                      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, padding: 10, background: "#f0faf3", border: "1px solid #c5e8d0", borderRadius: 3 }}>{nc.new_value?.role ?? "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Reaffirmed nodes — show notes/evidence since those are still valuable */}
      {reaffirmedNodes.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa" }}>
            Reaffirmed ({reaffirmedNodes.length}) — reviewed, no rating changes
          </div>
          {reaffirmedNodes.map((nc) => {
            const roleChanged = nc.old_value?.role !== nc.new_value?.role;
            return (
              <div key={nc.node_id} style={{ padding: "12px 14px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: nc.notes ? 6 : 0 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#0D7A3E", fontWeight: 600 }}>{nc.node_id}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#444" }}>{nc.node_name ?? ""}</span>
                  {roleChanged && <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>role text updated</span>}
                  {nc.confidence && (
                    <span style={{ fontSize: 11, color: nc.confidence === "high" ? "#18A055" : nc.confidence === "medium" ? "#8c5b00" : "#D94040", fontWeight: 500, marginLeft: roleChanged ? 0 : "auto" }}>
                      {humanize(nc.confidence)}
                    </span>
                  )}
                </div>
                {nc.notes && <p style={{ fontSize: 13, color: "#666", margin: 0, lineHeight: 1.5 }}>{nc.notes}</p>}
                {(nc.evidence_refs?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {nc.evidence_refs!.map((ref, i) => (
                      <EvidenceTag key={i} value={ref} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Accepted-change card for company history ──────────── */

function AcceptedChangeCard({ ac }: { ac: AcceptedChange }) {
  const isBottleneck = ac.entity_type === "bottleneck";
  const isCompany = ac.entity_type === "company";

  // ── Extract field changes from both shapes ──
  type FlatChange = { nodeId: string; field: string; old: string; new: string; isLongText?: boolean };
  const flatChanges: FlatChange[] = [];

  const rawDiffs = ac.field_diffs;
  if (Array.isArray(rawDiffs)) {
    // Company shape: [{ node_id, changes: { field: {old, new} } }]
    for (const fd of rawDiffs) {
      if (fd.changes && typeof fd.changes === "object") {
        for (const [field, vals] of Object.entries(fd.changes)) {
          // Skip array-valued fields (evidence_refs, watch_tickers) — rendered separately
          if (Array.isArray(vals?.old) || Array.isArray(vals?.new)) continue;
          const oldVal = String(vals?.old ?? "");
          const newVal = String(vals?.new ?? "");
          if (oldVal !== newVal) flatChanges.push({ nodeId: fd.node_id, field, old: oldVal, new: newVal, isLongText: field === "notes" || field === "role" });
        }
      } else if (fd.field) {
        flatChanges.push({ nodeId: fd.node_id, field: fd.field, old: String(fd.before ?? ""), new: String(fd.after ?? ""), isLongText: fd.field === "notes" || fd.field === "role" });
      }
    }
  } else if (rawDiffs && typeof rawDiffs === "object" && !Array.isArray(rawDiffs)) {
    // Bottleneck shape: { field: {old, new} } — flat dict at top level
    const nodeId = (ac.before_snapshot as any)?.node_id ?? ac.subject_key;
    for (const [field, vals] of Object.entries(rawDiffs as Record<string, any>)) {
      if (!vals || typeof vals !== "object") continue;
      const oldVal = vals.old;
      const newVal = vals.new;
      // Skip array diffs for evidence_refs (show them separately)
      if (Array.isArray(oldVal) || Array.isArray(newVal)) continue;
      const oldStr = String(oldVal ?? "");
      const newStr = String(newVal ?? "");
      if (oldStr !== newStr) flatChanges.push({ nodeId, field, old: oldStr, new: newStr, isLongText: field === "notes" || field === "role" });
    }
  }

  // Snapshot-based fallback for companies
  if (flatChanges.length === 0 && ac.before_snapshot && ac.after_snapshot && isCompany) {
    const DIFF_FIELDS = ["relevance", "revenue_exposure", "confidence", "node_fit"];
    const before = Array.isArray(ac.before_snapshot) ? ac.before_snapshot : [];
    const after = Array.isArray(ac.after_snapshot) ? ac.after_snapshot : [];
    for (const aft of after) {
      const bef = before.find((b: any) => b.node_id === aft.node_id);
      if (!bef) continue;
      for (const f of DIFF_FIELDS) {
        const oldV = String(bef[f] ?? "");
        const newV = String(aft[f] ?? "");
        if (oldV !== newV) flatChanges.push({ nodeId: aft.node_id, field: f, old: oldV, new: newV });
      }
    }
  }

  // ── Bottleneck: extract status-level diffs from snapshots ──
  const bnBefore = !Array.isArray(ac.before_snapshot) && ac.before_snapshot ? ac.before_snapshot : null;
  const bnAfter = !Array.isArray(ac.after_snapshot) && ac.after_snapshot ? ac.after_snapshot : null;
  const bnStatusDiffs: FlatChange[] = [];
  if (isBottleneck && bnBefore && bnAfter) {
    for (const f of ["status", "severity", "confidence"]) {
      const oldV = String((bnBefore as any)[f] ?? "");
      const newV = String((bnAfter as any)[f] ?? "");
      if (oldV !== newV) bnStatusDiffs.push({ nodeId: ac.subject_key, field: f, old: oldV, new: newV });
    }
  }

  // ── Bottleneck: extract notes diff ──
  const bnNotesBefore = bnBefore ? String((bnBefore as any).notes ?? "") : "";
  const bnNotesAfter = bnAfter ? String((bnAfter as any).notes ?? "") : "";
  const bnNotesChanged = bnNotesBefore !== bnNotesAfter;

  // ── Bottleneck: extract evidence diff ──
  const bnEvidenceBefore: string[] = bnBefore ? ((bnBefore as any).evidence_refs ?? []) : [];
  const bnEvidenceAfter: string[] = bnAfter ? ((bnAfter as any).evidence_refs ?? []) : [];
  const bnEvidenceAdded = bnEvidenceAfter.filter((e) => !bnEvidenceBefore.includes(e));
  const bnEvidenceRemoved = bnEvidenceBefore.filter((e) => !bnEvidenceAfter.includes(e));

  const allChanges = [...flatChanges, ...bnStatusDiffs];
  const hasAnyChange = allChanges.length > 0 || bnNotesChanged || bnEvidenceAdded.length > 0 || bnEvidenceRemoved.length > 0;
  const isReaffirmation = ac.decision_type === "reaffirmation" || (!hasAnyChange);
  const outcomeLabel = isReaffirmation ? "Reaffirmation" : "Auto-merge";
  const outcomeStyle = isReaffirmation
    ? { bg: "#f3f3f3", fg: "#666", border: "#e5e5e5" }
    : { bg: "#e6f4ea", fg: "#065c2d", border: "#c5e8d0" };

  // Group flat changes by node
  const byNode = new Map<string, FlatChange[]>();
  for (const fc of allChanges.filter((c) => !c.isLongText)) {
    if (!byNode.has(fc.nodeId)) byNode.set(fc.nodeId, []);
    byNode.get(fc.nodeId)!.push(fc);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Outcome + trigger row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>Outcome:</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 3, background: outcomeStyle.bg, color: outcomeStyle.fg, border: `1px solid ${outcomeStyle.border}` }}>
          {outcomeLabel}
        </span>
        {acceptedChangeExplanation(ac) ? (
          <span style={{ fontSize: 12, color: "#555", marginLeft: 8 }}>
            {acceptedChangeExplanation(ac)}
          </span>
        ) : (ac.trigger_reasons ?? []).length > 0 ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#888", marginLeft: 8 }}>Triggered by:</span>
            {ac.trigger_reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: "#e8f0fe", color: "#0b5ea8" }}>
                {humanize(r)}
              </span>
            ))}
          </>
        ) : null}
      </div>

      {(ac.evidence_used?.latest_financial_period || ac.policy_state?.grace_expires_at || ac.workflow_run_id || ac.company_run_record?.path) && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#777" }}>
          {ac.evidence_used?.latest_financial_period && <span>Financial period: {ac.evidence_used.latest_financial_period}</span>}
          {ac.policy_state?.grace_expires_at && <span>Grace expiry: {formatStamp(ac.policy_state.grace_expires_at)}</span>}
          {ac.workflow_run_id && <span>Run: {ac.workflow_run_id}</span>}
          {ac.company_run_record?.path && <span>Audit: {ac.company_run_record.path}</span>}
        </div>
      )}

      {/* ── Rationale (only if distinct from notes) ── */}
      {ac.summary && !(isBottleneck && ac.summary === bnNotesAfter) && (
        <div style={{ padding: "12px 14px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 4 }}>Rationale</div>
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0 }}>{ac.summary}</p>
        </div>
      )}

      {/* ── Bottleneck: status + assessment ── */}
      {isBottleneck && bnAfter && (
        <div style={{ padding: "14px 16px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4 }}>
          {/* Status row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            {["status", "severity", "confidence"].map((f) => {
              const val = String((bnAfter as any)[f] ?? "");
              const oldVal = bnBefore ? String((bnBefore as any)[f] ?? "") : val;
              const changed = val !== oldVal;
              const ss = f === "status" ? (STATUS_STYLE[val] ?? { bg: "#f3f3f3", fg: "#666" }) : null;
              return (
                <div key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#888", fontWeight: 500 }}>{humanize(f)}:</span>
                  {changed && oldVal ? (
                    <>
                      <span style={{ color: "#999", textDecoration: "line-through" }}>{humanize(oldVal)}</span>
                      <span style={{ color: "#bbb" }}>&rarr;</span>
                      <span style={{ fontWeight: 600, ...(ss ? { padding: "2px 8px", borderRadius: 2, background: ss.bg, color: ss.fg, fontSize: 12 } : { color: "#111" }) }}>
                        {humanize(val)}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontWeight: 600, ...(ss ? { padding: "2px 8px", borderRadius: 2, background: ss.bg, color: ss.fg, fontSize: 12 } : { color: "#111" }) }}>
                      {humanize(val)}
                      {!changed && <span style={{ fontWeight: 400, color: "#bbb", fontSize: 11, marginLeft: 4 }}>(unchanged)</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Watch tickers */}
          {((bnAfter as any).watch_tickers ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#888", fontWeight: 500, marginRight: 4 }}>Watch:</span>
              {(bnAfter as any).watch_tickers.map((t: string) => (
                <span key={t} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#0D7A3E", padding: "2px 8px", background: "#f0f8f3", borderRadius: 2, border: "1px solid #d4e8da" }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottleneck: notes ── */}
      {isBottleneck && bnNotesChanged && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa" }}>Assessment updated</div>
          {/* Current assessment (prominent) */}
          <div style={{ padding: "12px 14px", background: "#f0faf3", border: "1px solid #c5e8d0", borderRadius: 4 }}>
            <p style={{ fontSize: 13, color: "#333", lineHeight: 1.6, margin: 0 }}>{bnNotesAfter}</p>
          </div>
          {/* Previous assessment (collapsed, muted) */}
          <details style={{ fontSize: 12, color: "#999" }}>
            <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#aaa" }}>Previous assessment</summary>
            <div style={{ padding: "10px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4, marginTop: 6 }}>
              <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5, margin: 0 }}>{bnNotesBefore || "—"}</p>
            </div>
          </details>
        </div>
      )}
      {isBottleneck && !bnNotesChanged && bnNotesAfter && !(ac.summary && ac.summary !== bnNotesAfter) && (
        <div style={{ padding: "12px 14px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 4 }}>Assessment</div>
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0 }}>{bnNotesAfter}</p>
        </div>
      )}

      {/* ── Bottleneck: evidence changes ── */}
      {isBottleneck && (bnEvidenceAdded.length > 0 || bnEvidenceRemoved.length > 0) && (() => {
        // Don't duplicate the raw "CHANGED" section — skip evidence_refs from flat changes
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 6 }}>Evidence</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {bnEvidenceAdded.map((ref, i) => (
                <span key={`add-${i}`} style={{ fontSize: 11, padding: "2px 7px", background: "#f0faf3", border: "1px solid #c5e8d0", borderRadius: 2, color: "#065c2d" }}>
                  + <EvidenceTag value={ref} />
                </span>
              ))}
              {bnEvidenceRemoved.map((ref, i) => (
                <span key={`rm-${i}`} style={{ fontSize: 11, padding: "2px 7px", background: "#fff5f5", border: "1px solid #fde8e8", borderRadius: 2, color: "#991b1b", textDecoration: "line-through" }}>
                  <EvidenceTag value={ref} />
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Reaffirmation (no changes at all) ── */}
      {isReaffirmation && !isBottleneck && (
        <div style={{ padding: "14px 16px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: "#888" }}>No material field changes</div>
        </div>
      )}

      {/* ── Field diffs: split real changes from newly populated ── */}
      {!isReaffirmation && byNode.size > 0 && (() => {
        const realDiffs: FlatChange[] = [];
        const newlyPopulated: FlatChange[] = [];
        for (const fc of allChanges.filter((c) => !c.isLongText)) {
          if (fc.old) realDiffs.push(fc);
          else newlyPopulated.push(fc);
        }
        const realByNode = new Map<string, FlatChange[]>();
        for (const fc of realDiffs) {
          if (!realByNode.has(fc.nodeId)) realByNode.set(fc.nodeId, []);
          realByNode.get(fc.nodeId)!.push(fc);
        }
        const newByNode = new Map<string, FlatChange[]>();
        for (const fc of newlyPopulated) {
          if (!newByNode.has(fc.nodeId)) newByNode.set(fc.nodeId, []);
          newByNode.get(fc.nodeId)!.push(fc);
        }
        return (
          <div style={{ display: "grid", gap: 10 }}>
            {/* Real diffs — field had a value, now has a different value */}
            {realDiffs.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa" }}>
                  Changed ({realDiffs.length} field{realDiffs.length !== 1 ? "s" : ""})
                </div>
                {[...realByNode.entries()].map(([nodeId, changes]) => (
                  <div key={nodeId} style={{ padding: "14px 16px", border: "1px solid #e0e0e0", borderRadius: 4, background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#0D7A3E", fontWeight: 600 }}>{nodeId}</span>
                    </div>
                    {changes.map((fc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < changes.length - 1 ? "1px solid #f3f3f3" : undefined }}>
                        <span style={{ fontSize: 13, color: "#888", fontWeight: 500, minWidth: 130 }}>{humanize(fc.field)}</span>
                        <span style={{ fontSize: 13, color: "#999", textDecoration: "line-through" }}>{humanize(fc.old)}</span>
                        <span style={{ fontSize: 12, color: "#bbb" }}>&rarr;</span>
                        <span style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{humanize(fc.new)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {/* Newly populated — field was empty/unset, now has a value */}
            {newlyPopulated.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#bbb" }}>
                  Newly populated ({newlyPopulated.length} field{newlyPopulated.length !== 1 ? "s" : ""})
                </div>
                {[...newByNode.entries()].map(([nodeId, changes]) => (
                  <div key={nodeId} style={{ padding: "10px 14px", border: "1px solid #eee", borderRadius: 4, background: "#fafafa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#0D7A3E", fontWeight: 600 }}>{nodeId}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {changes.map((fc, i) => (
                        <span key={i} style={{ fontSize: 12, color: "#666" }}>
                          <span style={{ color: "#aaa" }}>{humanize(fc.field)}:</span> {humanize(fc.new)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Company: after snapshot ── */}
      {isCompany && Array.isArray(ac.after_snapshot) && ac.after_snapshot.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 6 }}>Current state</div>
          {ac.after_snapshot.map((node: any) => (
            <div key={node.node_id} style={{ padding: "10px 14px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4, marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#0D7A3E", fontWeight: 600 }}>{node.node_id}</span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
                {node.relevance && <span><span style={{ color: "#888" }}>Relevance:</span> <span style={{ color: "#111", fontWeight: 500 }}>{humanize(node.relevance)}</span></span>}
                {node.revenue_exposure && <span><span style={{ color: "#888" }}>Revenue:</span> <span style={{ color: "#111", fontWeight: 500 }}>{humanize(node.revenue_exposure)}</span></span>}
                {node.confidence && <span><span style={{ color: "#888" }}>Confidence:</span> <span style={{ color: "#111", fontWeight: 500 }}>{humanize(node.confidence)}</span></span>}
                {node.node_fit && <span><span style={{ color: "#888" }}>Fit:</span> <span style={{ color: "#111", fontWeight: 500 }}>{humanize(node.node_fit)}</span></span>}
                {(node.moat_in_node ?? []).length > 0 && (
                  <span><span style={{ color: "#888" }}>Moats:</span> <span style={{ color: "#111", fontWeight: 500 }}>{node.moat_in_node.map((m: string) => humanize(m)).join(", ")}</span></span>
                )}
              </div>
              {node.role && <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5, margin: "6px 0 0" }}>{node.role}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Top-level evidence (company) ── */}
      {isCompany && (ac.evidence_refs ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#888", marginRight: 6 }}>Evidence:</span>
          {ac.evidence_refs!.map((ref, i) => (
            <EvidenceTag key={i} value={ref} />
          ))}
        </div>
      )}

      {/* ── Bottleneck: full evidence list from snapshot ── */}
      {isBottleneck && bnEvidenceAdded.length === 0 && bnEvidenceRemoved.length === 0 && bnEvidenceAfter.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#888", marginRight: 6 }}>Evidence:</span>
          {bnEvidenceAfter.map((ref, i) => (
            <EvidenceTag key={i} value={ref} />
          ))}
        </div>
      )}

      {/* Metadata row */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#bbb", flexWrap: "wrap" }}>
        {ac.published_at && <span>Published: {new Date(ac.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
        {ac.knowledge_revision != null && <span>Rev: {ac.knowledge_revision}</span>}
        {ac.source_commit && <span style={{ fontFamily: "var(--font-data)" }}>Commit: {ac.source_commit.slice(0, 10)}</span>}
      </div>
    </div>
  );
}

function TaxonomyNodeRow({
  label,
  ids,
  tone = "neutral",
}: {
  label: string;
  ids?: string[];
  tone?: "neutral" | "remove" | "add" | "keep";
}) {
  const values = ids ?? [];
  if (values.length === 0) return null;
  const colors = tone === "remove"
    ? { bg: "#fff5f5", border: "#fde8e8", fg: "#991b1b" }
    : tone === "add"
      ? { bg: "#f0faf3", border: "#c5e8d0", fg: "#065c2d" }
      : tone === "keep"
        ? { bg: "#f8f9fa", border: "#e5e5e5", fg: "#444" }
        : { bg: "#fafafa", border: "#e5e5e5", fg: "#666" };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#888", minWidth: 108 }}>{label}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              padding: "3px 8px",
              borderRadius: 3,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.fg,
            }}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function TaxonomyReasonList({
  title,
  items,
  tone = "neutral",
}: {
  title: string;
  items: Array<{ node_id?: string; reason?: string; evidence_refs?: string[]; confidence?: string }>;
  tone?: "neutral" | "remove" | "add" | "keep";
}) {
  if (items.length === 0) return null;
  const border = tone === "remove" ? "#fde8e8" : tone === "add" ? "#c5e8d0" : "#e5e5e5";
  const bg = tone === "remove" ? "#fffafa" : tone === "add" ? "#f7fcf8" : "#fafafa";
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>{title}</div>
      {items.map((entry, idx) => (
        <div key={`${title}-${entry.node_id ?? "row"}-${idx}`} style={{ padding: "10px 12px", border: `1px solid ${border}`, background: bg, borderRadius: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: entry.reason ? 6 : 0 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#111", fontWeight: 600 }}>{entry.node_id ?? "—"}</span>
            {entry.confidence && <span style={{ fontSize: 11, color: "#888" }}>{humanize(entry.confidence)}</span>}
          </div>
          {entry.reason && <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{entry.reason}</p>}
          {(entry.evidence_refs?.length ?? 0) > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              {entry.evidence_refs!.map((ref, evidenceIdx) => (
                <EvidenceTag key={`${entry.node_id ?? "row"}-${evidenceIdx}`} value={ref} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TaxonomyDiff({ item }: { item: ReviewItem }) {
  const preview = item.action_preview ?? {};
  const proposed = item.proposed_value ?? {};
  const removalReasons = (proposed as any).suggested_removals ?? [];
  const additionReasons = (proposed as any).suggested_additions ?? [];
  const retainedReasons = (proposed as any).retained_membership ?? [];
  const ambiguities = (proposed as any).ambiguities ?? [];
  const summary = item.explain_summary ?? preview.summary ?? "Taxonomy membership review.";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ padding: "12px 14px", background: "#fff8ef", border: "1px solid #f3e1bf", borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#8c5b00", marginBottom: 4 }}>If You Accept</div>
        <p style={{ fontSize: 13, color: "#6a4a00", lineHeight: 1.6, margin: 0 }}>{summary}</p>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <TaxonomyNodeRow label="Current" ids={preview.current_node_ids} />
        <TaxonomyNodeRow label="Remove" ids={preview.removal_node_ids} tone="remove" />
        <TaxonomyNodeRow label="Add" ids={preview.addition_node_ids} tone="add" />
        <TaxonomyNodeRow label="Keep" ids={preview.retained_node_ids ?? item.resulting_node_ids} tone="keep" />
        <TaxonomyNodeRow label="After Accept" ids={preview.resulting_node_ids ?? item.resulting_node_ids} tone="keep" />
        <TaxonomyNodeRow label="Ambiguous" ids={preview.ambiguity_node_ids} />
      </div>

      <TaxonomyReasonList title="Why remove" items={removalReasons} tone="remove" />
      <TaxonomyReasonList title="Why keep" items={retainedReasons} tone="keep" />
      <TaxonomyReasonList title="Why add" items={additionReasons} tone="add" />

      {ambiguities.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>Ambiguities</div>
          {ambiguities.map((entry: any, idx: number) => (
            <div key={`ambiguity-${entry.node_id ?? idx}`} style={{ padding: "10px 12px", border: "1px solid #eee", background: "#fafafa", borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: entry.why_unclear ? 6 : 0 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "#111", fontWeight: 600 }}>{entry.node_id ?? "—"}</span>
              </div>
              {entry.why_unclear && <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{entry.why_unclear}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export function ReviewQueueApp() {
  const router = useRouter();

  /* ── SWR data hooks ──────────────────────────────────── */
  const [tab, setTab] = useState<"pending" | "history" | "auto-merged">("pending");

  const { data, error, isLoading, mutate } = useReviewQueue();
  const { data: decisionsRaw, isLoading: histDecLoading } = useReviewDecisions(tab === "history");
  const { data: acceptedRaw, isLoading: histAccLoading } = useAcceptedChanges("entity_type=company&limit=100", tab === "history");
  const pastDecisions: Decision[] = decisionsRaw?.decisions ?? [];
  const acceptedChanges: AcceptedChange[] = (Array.isArray(acceptedRaw) ? acceptedRaw : acceptedRaw?.changes ?? acceptedRaw?.items ?? []) as AcceptedChange[];
  const histLoading = histDecLoading || histAccLoading;

  const { data: autoMergedRaw, isLoading: amLoading } = useAcceptedChanges("limit=200", tab === "auto-merged");
  const autoMergedAll: AcceptedChange[] | null = autoMergedRaw
    ? ((Array.isArray(autoMergedRaw) ? autoMergedRaw : autoMergedRaw?.items ?? []) as AcceptedChange[])
    : null;

  /* ── UI state ────────────────────────────────────────── */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedHistKey, setExpandedHistKey] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [actionResults, setActionResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [entityFilter, setEntityFilter] = useState<"all" | "company_refresh" | "taxonomy_classification" | "bottleneck_assessment">("all");
  const [amWindow, setAmWindow] = useState<"1h" | "3h" | "24h" | "all">("3h");

  // Index accepted-changes by subject_key for fast lookup
  const acBySubject = useMemo(() => {
    const map = new Map<string, AcceptedChange[]>();
    for (const ac of acceptedChanges ?? []) {
      const key = ac.subject_key;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ac);
    }
    return map;
  }, [acceptedChanges]);

  // Match a decision to its best accepted-change by subject_key + nearest timestamp
  function matchAcceptedChange(d: Decision): AcceptedChange | null {
    if (d.entity_type !== "company_refresh") return null;
    const candidates = acBySubject.get(d.subject_key);
    if (!candidates || candidates.length === 0) return null;
    const dTime = new Date(d.reviewed_at).getTime();
    let best: AcceptedChange | null = null;
    let bestDelta = Infinity;
    for (const ac of candidates) {
      const delta = Math.abs(new Date(ac.published_at).getTime() - dTime);
      // Only match within 1 hour window
      if (delta < bestDelta && delta < 3600000) {
        bestDelta = delta;
        best = ac;
      }
    }
    return best;
  }

  // Filter auto-merged by time window, sort most recent first
  const autoMergedFiltered = useMemo(() => {
    if (!autoMergedAll) return [];
    const sorted = [...autoMergedAll].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    if (amWindow === "all") return sorted;
    const hours = amWindow === "1h" ? 1 : amWindow === "3h" ? 3 : 24;
    const cutoff = Date.now() - hours * 3600000;
    return sorted.filter((ac) => new Date(ac.published_at).getTime() >= cutoff);
  }, [autoMergedAll, amWindow]);

  async function handleAction(key: string, action: "accept" | "reject" | "dismiss") {
    setActing((prev) => new Set(prev).add(key));
    setActionResults((prev) => { const next = { ...prev }; delete next[key]; return next; });
    try {
      // Optimistic update — immediately remove from local cache
      mutate(
        (current: any) => current ? {
          ...current,
          items: current.items.filter((i: any) => i.proposal_key !== key),
          summary: { ...current.summary, queue_count: (current.summary.queue_count ?? 1) - 1 },
        } : current,
        { revalidate: false },
      );

      const res = await fetch(`/api/operator/reviews/${encodeURIComponent(key)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_by: "portal:operator" }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        // Revalidate to sync with server
        mutate();
      } else {
        // Revert optimistic update
        mutate();
        const detail = body?.detail ?? body?.error ?? `Failed (${res.status})`;
        const msg = typeof detail === "string" ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200);
        setActionResults((prev) => ({ ...prev, [key]: { ok: false, message: msg } }));
      }
    } catch (e) {
      // Revert optimistic update
      mutate();
      setActionResults((prev) => ({ ...prev, [key]: { ok: false, message: e instanceof Error ? e.message : "Unknown error" } }));
    } finally {
      setActing((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  if (isLoading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed: {error.message}</div>;
  if (!data) return null;

  const queueData = data as ReviewQueueResponse;
  const allItems = queueData.items ?? [];
  const items = entityFilter === "all" ? allItems : allItems.filter((i) => i.entity_type === entityFilter);
  const companyCount = allItems.filter((i) => i.entity_type === "company_refresh").length;
  const taxonomyCount = allItems.filter((i) => i.entity_type === "taxonomy_classification").length;
  const bottleneckCount = allItems.filter((i) => i.entity_type === "bottleneck_assessment").length;

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Reviews</h1>
          <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>
            {allItems.length} pending · {companyCount} company · {taxonomyCount} taxonomy · {bottleneckCount} bottleneck
          </p>
        </div>
        <button type="button" onClick={() => mutate()} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
        <button type="button" onClick={() => setTab("pending")} style={{
          all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "pending" ? 500 : 400,
          color: tab === "pending" ? "#111" : "#999", borderBottom: tab === "pending" ? "2px solid #0D7A3E" : "2px solid transparent",
        }}>
          Pending ({allItems.length})
        </button>
        <button type="button" onClick={() => setTab("history")} style={{
          all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "history" ? 500 : 400,
          color: tab === "history" ? "#111" : "#999", borderBottom: tab === "history" ? "2px solid #0D7A3E" : "2px solid transparent",
        }}>
          Decisions ({pastDecisions.length})
        </button>
        <button type="button" onClick={() => setTab("auto-merged")} style={{
          all: "unset", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: tab === "auto-merged" ? 500 : 400,
          color: tab === "auto-merged" ? "#111" : "#999", borderBottom: tab === "auto-merged" ? "2px solid #0D7A3E" : "2px solid transparent",
        }}>
          Auto-Merged {autoMergedAll ? `(${autoMergedFiltered.length})` : ""}
        </button>
      </div>

      {/* ── Pending Tab ─────────────────────────────── */}
      {tab === "pending" && (
        <div>
          {/* Entity type filter */}
          {allItems.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {(["all", "company_refresh", "taxonomy_classification", "bottleneck_assessment"] as const).map((f) => {
                const count =
                  f === "all" ? allItems.length :
                  f === "company_refresh" ? companyCount :
                  f === "taxonomy_classification" ? taxonomyCount :
                  bottleneckCount;
                const label =
                  f === "all" ? "All" :
                  f === "company_refresh" ? "Companies" :
                  f === "taxonomy_classification" ? "Taxonomy" :
                  "Bottlenecks";
                const active = entityFilter === f;
                return (
                  <button key={f} type="button" onClick={() => setEntityFilter(f)} style={{
                    all: "unset", cursor: "pointer", fontSize: 13, padding: "5px 14px", borderRadius: 3,
                    background: active ? "#111" : "#f3f3f3", color: active ? "#fff" : "#666", fontWeight: active ? 500 : 400,
                  }}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>
              {allItems.length === 0 ? "No pending reviews. All judgments are up to date." : `No ${
                entityFilter === "company_refresh" ? "company" :
                entityFilter === "taxonomy_classification" ? "taxonomy" :
                "bottleneck"
              } reviews pending.`}
            </div>
          )}

          {/* Items */}
          {items.map((item) => {
            const expanded = expandedKey === item.proposal_key;
            const isCompany = item.entity_type === "company_refresh";
            const isBottleneck = item.entity_type === "bottleneck_assessment";
            const isTaxonomy = item.entity_type === "taxonomy_classification";
            const nodes = item.proposed_value?.nodes ?? [];
            const isActing = acting.has(item.proposal_key);
            const itemResult = actionResults[item.proposal_key];
            const ps = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.medium;

            return (
              <div key={item.proposal_key} style={{ border: "1px solid #e5e5e5", marginBottom: 10, background: "#fff", borderRadius: 4 }}>
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : item.proposal_key)}
                  style={{
                    all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "14px 20px", boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: "#999", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", lineHeight: 1 }}>&#9654;</span>
                    {/* Entity type badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 2, flexShrink: 0,
                      background: isCompany ? "#e8f0fe" : isTaxonomy ? "#fff7e8" : "#f0f8f3",
                      color: isCompany ? "#0b5ea8" : isTaxonomy ? "#8c5b00" : "#0D7A3E",
                    }}>
                      {item.entity_label ?? (isCompany ? "Company" : isTaxonomy ? "Taxonomy" : "Bottleneck")}
                    </span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#0D7A3E", fontWeight: 500 }}>
                      {item.subject_key}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.subject_label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: ps.bg, color: ps.fg, flexShrink: 0 }}>
                      {humanize(item.priority)}
                    </span>
                    {(item.impact_flags ?? []).includes("core_company") && (
                      <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 3, background: "#e8f0fe", color: "#0b5ea8", flexShrink: 0 }}>Core</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {isCompany && (() => {
                      const materialCount = nodes.filter(hasMaterialChange).length;
                      return (
                        <span style={{ fontSize: 12, color: materialCount > 0 ? "#111" : "#aaa" }}>
                          {nodes.length} node{nodes.length !== 1 ? "s" : ""}
                          {materialCount > 0 && <span style={{ color: "#0D7A3E", fontWeight: 500 }}> · {materialCount} changed</span>}
                          {materialCount === 0 && <span style={{ color: "#aaa" }}> · role text only</span>}
                        </span>
                      );
                    })()}
                    {isTaxonomy && item.action_preview && (
                      <span style={{ fontSize: 12, color: "#888" }}>
                        {item.action_preview.removal_node_ids?.length ?? 0} remove
                        {(item.action_preview.addition_node_ids?.length ?? 0) > 0 && <span> · {item.action_preview.addition_node_ids!.length} add</span>}
                        {(item.action_preview.retained_node_ids?.length ?? 0) > 0 && <span> · {item.action_preview.retained_node_ids!.length} keep</span>}
                      </span>
                    )}
                    {isBottleneck && item.proposed_summary && (
                      <span style={{ fontSize: 12, color: "#888", fontFamily: "var(--font-data)" }}>{item.proposed_summary}</span>
                    )}
                    <span style={{ fontSize: 11, color: "#ccc", fontFamily: "var(--font-data)" }}>{timeAgo(item.artifact_generated_at)}</span>
                  </div>
                </button>

                {/* Trigger reasons */}
                {(() => {
                  const reasons: string[] = (item as any).trigger_reasons ?? [];
                  const fallback = isCompany ? "Routine re-assessment" : "Bottleneck reassessment";
                  const tags = reasons.length > 0 ? reasons : [fallback];
                  const tagColor = (r: string) => {
                    const rl = r.toLowerCase();
                    if (rl.includes("news") || rl.includes("triage")) return { bg: "#e8f0fe", fg: "#0b5ea8" };
                    if (rl.includes("bottleneck")) return { bg: "#fef3cd", fg: "#8c5b00" };
                    if (rl.includes("routine") || rl.includes("re-assessment")) return { bg: "#f3f3f3", fg: "#888" };
                    return { bg: "#f0f8f3", fg: "#0D7A3E" };
                  };
                  return (
                    <div style={{ padding: "0 20px 10px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {tags.map((r, i) => {
                        const tc = tagColor(r);
                        return <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: tc.bg, color: tc.fg }}>{r}</span>;
                      })}
                    </div>
                  );
                })()}

                {/* Expanded */}
                {expanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                    {/* Context bar */}
                    <div style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#999", flexWrap: "wrap" }}>
                      {item.artifact_generated_at && <span>Generated: {new Date(item.artifact_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      {item.freshest_evidence_at && <span>Latest evidence: {new Date(item.freshest_evidence_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                      {item.latest_transcript_date_used && <span>Transcript: {item.latest_transcript_date_used}</span>}
                      {item.confidence && <span>Confidence: <strong style={{ color: item.confidence === "high" ? "#18A055" : item.confidence === "medium" ? "#8c5b00" : "#D94040" }}>{humanize(item.confidence)}</strong></span>}
                      {item.merge_mode && <span>Mode: {humanize(item.merge_mode)}</span>}
                    </div>

                    {/* Company: node change cards */}
                    {isCompany && nodes.length > 0 && (
                      <div style={{ padding: "14px 0" }}>
                        <CompanyNodeChanges nodes={nodes} />
                      </div>
                    )}

                    {/* Taxonomy: membership diff */}
                    {isTaxonomy && (
                      <div style={{ padding: "14px 0" }}>
                        <TaxonomyDiff item={item} />
                      </div>
                    )}

                    {/* Bottleneck: diff */}
                    {isBottleneck && (
                      <div style={{ padding: "14px 0" }}>
                        <BottleneckDiff current={item.current_value} proposed={item.proposed_value} />
                      </div>
                    )}

                    {/* AI Summary — compact, below node cards */}
                    {item.structured_rationale && (
                      <div style={{ padding: "12px 14px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 4, marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 4 }}>AI Summary</div>
                        <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0 }}>{item.structured_rationale}</p>
                      </div>
                    )}

                    {/* Top-level evidence (only if no per-node evidence shown) */}
                    {!isCompany && (item.evidence_refs?.length ?? 0) > 0 && (
                      <div style={{ paddingTop: 10, borderTop: "1px solid #f0f0f0", display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#888", marginRight: 6 }}>Evidence:</span>
                        {item.evidence_refs!.map((ref, i) => (
                          <EvidenceTag key={i} value={ref} />
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
                      {isActing && <span className="op-spinner" style={{ marginRight: 8 }} />}
                      <button type="button" disabled={isActing} onClick={() => handleAction(item.proposal_key, "dismiss")}
                        className="fin-btn" style={{ color: "#888", opacity: isActing ? 0.4 : 1 }}>Dismiss</button>
                      <button type="button" disabled={isActing} onClick={() => handleAction(item.proposal_key, "reject")}
                        className="fin-btn" style={{ background: "#fff5f5", color: "#D94040", border: "1px solid #fde8e8", opacity: isActing ? 0.4 : 1 }}>Reject</button>
                      <button type="button" disabled={isActing} onClick={() => handleAction(item.proposal_key, "accept")}
                        className="fin-btn fin-btn--on" style={{ padding: "6px 20px", opacity: isActing ? 0.4 : 1 }}>Accept</button>
                    </div>

                    {/* Action feedback (errors only — success removes the item) */}
                    {itemResult && !itemResult.ok && (
                      <div style={{
                        marginTop: 10, padding: "8px 12px", borderRadius: 3, fontSize: 13,
                        background: "#fff5f5", border: "1px solid #f2b8b5", color: "#991b1b",
                      }}>
                        {itemResult.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── History Tab ─────────────────────────────── */}
      {tab === "history" && (
        <div>
          {histLoading && <div className="op-loading"><span className="op-spinner" /></div>}
          {!histLoading && pastDecisions.length === 0 && (
            <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>No past decisions.</div>
          )}
          {pastDecisions.map((d) => {
            const expanded = expandedHistKey === d.entry_id;
            const isCompany = d.entity_type === "company_refresh";
            const isBottleneck = d.entity_type === "bottleneck_assessment";
            const isTaxonomy = d.entity_type === "taxonomy_classification";
            const rv = reviewerLabel(d.reviewed_by);
            const ps = PRIORITY_STYLE[d.priority ?? "medium"] ?? PRIORITY_STYLE.medium;
            // Decisions feed returns proposed_value as either { nodes: [...] } or a flat array
            const rawPV = d.proposed_value;
            const rawCV = d.current_value;
            const nodes: NodeChange[] = Array.isArray(rawPV) ? rawPV : rawPV?.nodes ?? [];
            const currentNodes: any[] = Array.isArray(rawCV) ? rawCV : rawCV?.nodes ?? [];
            // For company decisions where proposed_value is a flat array, synthesize NodeChange objects
            const companyNodes: NodeChange[] = isCompany && nodes.length > 0
              ? nodes.map((n: any) => {
                  const cur = currentNodes.find((c: any) => c.node_id === n.node_id);
                  return { node_id: n.node_id, node_name: n.node_name, new_value: n, old_value: cur ?? undefined, confidence: n.confidence, notes: n.notes, evidence_refs: n.evidence_refs } as NodeChange;
                })
              : nodes;
            const hasValues = d.proposed_value != null || d.current_value != null;

            // For company rows, try to match a richer accepted-change record
            const ac = isCompany ? matchAcceptedChange(d) : null;
            const useAC = ac != null;

            // Decision type: prefer accepted-change, then decision_type from decisions feed, then infer
            const decisionType = ac?.decision_type ?? d.decision_type;
            const isReaffirmation = decisionType === "reaffirmation" || (useAC && (Array.isArray(ac.field_diffs) ? ac.field_diffs : []).length === 0);

            // Resolve trigger_reasons: prefer ac, then d, then derive
            const triggerReasons = (useAC ? ac.trigger_reasons : null) ?? d.trigger_reasons ?? [];

            const decisionLabel = isReaffirmation ? "Reaffirmation"
              : decisionType === "auto_merge" ? "Auto-merge"
              : d.decision === "accept" ? "Accepted"
              : d.decision === "reject" ? "Rejected"
              : d.decision === "dismiss" ? "Dismissed"
              : humanize(d.decision);
            const decisionStyle = isReaffirmation
              ? { bg: "#f3f3f3", fg: "#666", border: "#e5e5e5" }
              : d.decision === "accept" || decisionType === "auto_merge"
                ? { bg: "#e6f4ea", fg: "#065c2d", border: "#c5e8d0" }
                : d.decision === "reject"
                  ? { bg: "#fde8e8", fg: "#991b1b", border: "#f2b8b5" }
                  : { bg: "#f3f3f3", fg: "#666", border: "#e5e5e5" };

            return (
              <div key={d.entry_id} style={{ border: "1px solid #e5e5e5", marginBottom: 10, background: "#fff", borderRadius: 4 }}>
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpandedHistKey(expanded ? null : d.entry_id)}
                  style={{
                    all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "14px 20px", boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: "#999", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", lineHeight: 1 }}>&#9654;</span>
                    {/* Decision badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 3,
                      background: decisionStyle.bg, color: decisionStyle.fg, border: `1px solid ${decisionStyle.border}`, flexShrink: 0,
                    }}>
                      {decisionLabel}
                    </span>
                    {/* Entity type badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 2, flexShrink: 0,
                      background: isCompany ? "#e8f0fe" : isTaxonomy ? "#fff7e8" : "#f0f8f3",
                      color: isCompany ? "#0b5ea8" : isTaxonomy ? "#8c5b00" : "#0D7A3E",
                    }}>
                      {isCompany ? "Company" : isTaxonomy ? "Taxonomy" : isBottleneck ? "Bottleneck" : humanize(d.entity_type)}
                    </span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#0D7A3E", fontWeight: 500 }}>
                      {d.subject_key}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.subject_label}
                    </span>
                    {d.priority && (
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: ps.bg, color: ps.fg, flexShrink: 0 }}>
                        {humanize(d.priority)}
                      </span>
                    )}
                    {(d.impact_flags ?? []).includes("core_company") && (
                      <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 3, background: "#e8f0fe", color: "#0b5ea8", flexShrink: 0 }}>Core</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {/* Reviewer */}
                    <span style={{ fontSize: 12, ...rv.style }}>{rv.label}</span>
                    {/* Merge status */}
                    {d.merge_executed != null && (
                      <span style={{ fontSize: 11, color: d.merge_exit_code === 0 ? "#18A055" : "#D94040", fontWeight: 500 }}>
                        {d.merge_exit_code === 0 ? "Merged" : "Merge Failed"}
                      </span>
                    )}
                    {/* Time */}
                    <span style={{ fontSize: 11, color: "#ccc", fontFamily: "var(--font-data)" }}>{timeAgo(d.reviewed_at)}</span>
                  </div>
                </button>

                {/* Trigger / context row */}
                {(() => {
                  // 1. Explicit trigger_reasons from accepted-change or decision
                  const triggers: string[] = [...triggerReasons];

                  // 2. No explicit reasons — try structured inference (no guessing)
                  if (triggers.length === 0) {
                    if (d.reviewed_by === "system:auto_accept_bottleneck_reaffirmations") {
                      triggers.push("Auto-accepted bottleneck reaffirmation");
                    } else if (d.decision_source === "system_auto_accept" && d.reviewed_by?.startsWith("system:auto_accept")) {
                      triggers.push("Auto-accepted reaffirmation");
                    } else if (d.decision_source === "provenance_ledger" && decisionType === "reaffirmation") {
                      triggers.push("Reaffirmed after new evidence");
                    } else if (d.reviewed_by === "system:auto_merge") {
                      triggers.push("Auto-merge (low-risk)");
                    } else if (d.reviewed_by === "system:duplicate_cleanup") {
                      triggers.push("Duplicate cleanup");
                    }
                    // Otherwise: show nothing — better no chip than a fake one
                  }

                  const explanation = useAC && ac ? acceptedChangeExplanation(ac) : null;
                  if (triggers.length === 0 && !explanation) {
                    // No trigger context — just show the timestamp
                    return d.reviewed_at ? (
                      <div style={{ padding: "0 20px 10px" }}>
                        <span style={{ fontSize: 11, color: "#ccc" }}>
                          {new Date(d.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : null;
                  }

                  const tagColor = (r: string) => {
                    const rl = r.toLowerCase();
                    if (rl.includes("news") || rl.includes("press") || rl.includes("triage")) return { bg: "#e8f0fe", fg: "#0b5ea8" };
                    if (rl.includes("earning") || rl.includes("transcript")) return { bg: "#f0f8f3", fg: "#0D7A3E" };
                    if (rl.includes("signal")) return { bg: "#fef3cd", fg: "#8c5b00" };
                    if (rl.includes("web") || rl.includes("research")) return { bg: "#f0f0ff", fg: "#5b21b6" };
                    if (rl.includes("bottleneck")) return { bg: "#fef3cd", fg: "#8c5b00" };
                    if (rl.includes("material")) return { bg: "#e8f0fe", fg: "#0b5ea8" };
                    if (rl.includes("auto") || rl.includes("dedup") || rl.includes("cleanup") || rl.includes("reaffirm")) return { bg: "#f3f3f3", fg: "#888" };
                    return { bg: "#f0f8f3", fg: "#0D7A3E" };
                  };
                  return (
                    <div style={{ padding: "0 20px 10px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {explanation ? (
                        <span style={{ fontSize: 11, color: "#666" }}>{explanation}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#aaa" }}>Triggered by:</span>
                          {triggers.map((r, i) => {
                            const tc = tagColor(r);
                            return <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: tc.bg, color: tc.fg }}>{humanize(r)}</span>;
                          })}
                        </>
                      )}
                      {d.reviewed_at && (
                        <span style={{ fontSize: 11, color: "#ccc", marginLeft: 4 }}>
                          {new Date(d.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                    {/* Context bar */}
                    <div style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#999", flexWrap: "wrap" }}>
                      {d.artifact_generated_at && <span>Generated: {new Date(d.artifact_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      {d.freshest_evidence_at && <span>Latest evidence: {new Date(d.freshest_evidence_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                      {d.latest_transcript_date_used && <span>Transcript: {d.latest_transcript_date_used}</span>}
                      {d.confidence && <span>Confidence: <strong style={{ color: d.confidence === "high" ? "#18A055" : d.confidence === "medium" ? "#8c5b00" : "#D94040" }}>{humanize(d.confidence)}</strong></span>}
                      {d.merge_mode && <span>Mode: {humanize(d.merge_mode)}</span>}
                      {d.merge_executed != null && (
                        <span>Merge: <strong style={{ color: d.merge_exit_code === 0 ? "#18A055" : "#D94040" }}>{d.merge_exit_code === 0 ? "OK" : `Failed (${d.merge_exit_code})`}</strong></span>
                      )}
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10 }}>
                        {d.proposal_key ? d.proposal_key.slice(0, 40) + (d.proposal_key.length > 40 ? "..." : "") : "Auto-merged"}
                      </span>
                    </div>

                    {/* ── Company: prefer accepted-change card ── */}
                    {useAC && (
                      <div style={{ padding: "14px 0" }}>
                        <AcceptedChangeCard ac={ac} />
                      </div>
                    )}

                    {/* Company: fallback to decisions-feed nodes when no AC match */}
                    {!useAC && isCompany && hasValues && companyNodes.length > 0 && (
                      <div style={{ padding: "14px 0" }}>
                        <CompanyNodeChanges nodes={companyNodes} />
                      </div>
                    )}

                    {/* Taxonomy */}
                    {isTaxonomy && hasValues && (
                      <div style={{ padding: "14px 0" }}>
                        <TaxonomyDiff item={{
                          proposal_key: d.proposal_key ?? d.entry_id,
                          entity_type: d.entity_type,
                          subject_key: d.subject_key,
                          subject_label: d.subject_label,
                          priority: d.priority ?? "medium",
                          proposed_value: d.proposed_value,
                          current_value: d.current_value,
                          action_preview: d.action_preview,
                          explain_summary: d.explain_summary,
                          retained_node_ids: d.retained_node_ids,
                        }} />
                      </div>
                    )}

                    {/* Bottleneck */}
                    {isBottleneck && hasValues && (
                      <div style={{ padding: "14px 0" }}>
                        <BottleneckDiff current={d.current_value} proposed={d.proposed_value} />
                      </div>
                    )}

                    {/* Summary — always show for non-AC rows (primary explanation for bottlenecks) */}
                    {!useAC && (d.structured_rationale ?? d.summary) && (
                      <div style={{ padding: "12px 14px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 4, marginTop: hasValues ? 4 : 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#aaa", marginBottom: 4 }}>
                          {d.structured_rationale ? "AI Summary" : "Summary"}
                        </div>
                        <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0 }}>{d.structured_rationale ?? d.summary}</p>
                      </div>
                    )}

                    {/* Node IDs — only when no rich data and no summary */}
                    {!useAC && !hasValues && !d.structured_rationale && !d.summary && (d.node_ids ?? []).length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>Nodes:</span>
                        {d.node_ids!.map((nid) => (
                          <span key={nid} style={{ fontFamily: "var(--font-data)", fontSize: 12, padding: "2px 8px", background: "#f3f3f3", borderRadius: 2, color: "#444" }}>{nid}</span>
                        ))}
                      </div>
                    )}

                    {/* Evidence tags — non-company or non-AC company */}
                    {!useAC && !isCompany && (d.evidence_refs?.length ?? 0) > 0 && (
                      <div style={{ paddingTop: 10, borderTop: "1px solid #f0f0f0", display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#888", marginRight: 6 }}>Evidence:</span>
                        {d.evidence_refs!.map((ref, i) => (
                          <EvidenceTag key={i} value={ref} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Auto-Merged Tab ───────────────────────────── */}
      {tab === "auto-merged" && (
        <div>
          {/* Time-window filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(["1h", "3h", "24h", "all"] as const).map((w) => {
              const active = amWindow === w;
              const label = w === "all" ? "All" : w.toUpperCase();
              return (
                <button key={w} type="button" onClick={() => setAmWindow(w)} style={{
                  all: "unset", cursor: "pointer", fontSize: 13, padding: "5px 14px", borderRadius: 3,
                  background: active ? "#111" : "#f3f3f3", color: active ? "#fff" : "#666", fontWeight: active ? 500 : 400,
                }}>
                  {label}
                </button>
              );
            })}
            <span style={{ fontSize: 12, color: "#bbb", alignSelf: "center", marginLeft: 8 }}>
              {autoMergedFiltered.length} result{autoMergedFiltered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {amLoading && <div className="op-loading"><span className="op-spinner" /></div>}

          {!amLoading && autoMergedFiltered.length === 0 && (
            <div style={{ border: "1px solid #e5e5e5", padding: "40px 20px", textAlign: "center", color: "#999" }}>
              No auto-merged changes in this window.
            </div>
          )}

          {autoMergedFiltered.map((ac) => {
            // Count actual field changes vs newly populated
            const rawDiffs = Array.isArray(ac.field_diffs) ? ac.field_diffs : [];
            let realChangeCount = 0;
            let newlyPopCount = 0;
            const nodeIds = new Set<string>();
            for (const fd of rawDiffs) {
              if (fd.changes && typeof fd.changes === "object") {
                for (const [, v] of Object.entries(fd.changes)) {
                  const oldV = String(v?.old ?? "");
                  const newV = String(v?.new ?? "");
                  if (oldV === newV) continue;
                  if (oldV) { realChangeCount++; nodeIds.add(fd.node_id); }
                  else { newlyPopCount++; nodeIds.add(fd.node_id); }
                }
              } else if (fd.field) {
                if (fd.before) realChangeCount++;
                else newlyPopCount++;
                nodeIds.add(fd.node_id);
              }
            }
            const totalChanges = realChangeCount + newlyPopCount;
            const isReaffirmation = ac.decision_type === "reaffirmation" || totalChanges === 0;
            const isCompanyAC = ac.entity_type === "company";
            const outcomeStyle = isReaffirmation
              ? { bg: "#f3f3f3", fg: "#666", border: "#e5e5e5", label: "Reaffirmation" }
              : { bg: "#e6f4ea", fg: "#065c2d", border: "#c5e8d0", label: "Auto-merge" };
            const expanded = expandedHistKey === ac.change_id;

            const diffSummary = totalChanges === 0
              ? "No material field changes"
              : realChangeCount > 0
                ? `${realChangeCount} field${realChangeCount !== 1 ? "s" : ""} changed across ${nodeIds.size} node${nodeIds.size !== 1 ? "s" : ""}${newlyPopCount > 0 ? ` + ${newlyPopCount} newly set` : ""}`
                : `${newlyPopCount} field${newlyPopCount !== 1 ? "s" : ""} newly populated`;

            return (
              <div key={ac.change_id} style={{ border: "1px solid #e5e5e5", marginBottom: 8, background: "#fff", borderRadius: 4 }}>
                <button
                  type="button"
                  onClick={() => setExpandedHistKey(expanded ? null : ac.change_id)}
                  style={{
                    all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "12px 20px", boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: "#999", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", lineHeight: 1 }}>&#9654;</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 3,
                      background: outcomeStyle.bg, color: outcomeStyle.fg, border: `1px solid ${outcomeStyle.border}`, flexShrink: 0,
                    }}>
                      {outcomeStyle.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 2, flexShrink: 0,
                      background: isCompanyAC ? "#e8f0fe" : "#f0f8f3",
                      color: isCompanyAC ? "#0b5ea8" : "#0D7A3E",
                    }}>
                      {isCompanyAC ? "Company" : humanize(ac.entity_type)}
                    </span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#0D7A3E", fontWeight: 500 }}>
                      {ac.subject_key}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ac.subject_label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: isReaffirmation ? "#aaa" : "#444" }}>
                      {diffSummary}
                    </span>
                    <span style={{ fontSize: 11, color: "#ccc", fontFamily: "var(--font-data)" }}>{timeAgo(ac.published_at)}</span>
                  </div>
                </button>

                <div style={{ padding: "0 20px 10px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {acceptedChangeExplanation(ac) ? (
                    <span style={{ fontSize: 11, color: "#666" }}>{acceptedChangeExplanation(ac)}</span>
                  ) : (ac.trigger_reasons ?? []).length > 0 ? (
                    <>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#aaa" }}>Triggered by:</span>
                      {ac.trigger_reasons.map((r, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: "#e8f0fe", color: "#0b5ea8" }}>
                          {humanize(r)}
                        </span>
                      ))}
                    </>
                  ) : isReaffirmation ? (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 2, background: "#f3f3f3", color: "#888" }}>
                      Reaffirmed — no trigger context from engine
                    </span>
                  ) : null}
                  <span style={{ fontSize: 11, color: "#ccc", marginLeft: 4 }}>
                    Published: {new Date(ac.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {expanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                    <div style={{ padding: "14px 0" }}>
                      <AcceptedChangeCard ac={ac} />
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
}
