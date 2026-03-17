"use client";

import { useEffect, useState } from "react";
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
  knowledge_revision: string;
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

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function statusColor(s: string): string {
  if (s === "binding") return "#D94040";
  return "#444";
}

function severityColor(s: string): string {
  if (s === "critical") return "#D94040";
  if (s === "high") return "#B08415";
  return "#444";
}

export function BottlenecksApp() {
  const router = useRouter();
  const [payload, setPayload] = useState<BottlenecksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/operator/bottlenecks/active", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d) => setPayload(d as BottlenecksResponse))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed to load bottlenecks: {error}</div>;
  if (!payload) return null;

  const { active_count, binding_count, by_status } = payload.summary;
  const monitoringCount = by_status?.monitoring ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Bottlenecks</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {active_count} active · {binding_count} binding
          </div>
        </div>
        <button type="button" onClick={load} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>
          Refresh
        </button>
      </div>

      {/* Summary metrics */}
      <div className="co-panel-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="co-panel">
          <div className="co-panel-title">Active</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{active_count}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Binding</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#D94040" }}>{binding_count}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Monitoring</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{monitoringCount}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Last Assessed</div>
          <div style={{ fontSize: 16, fontFamily: "var(--font-data)", fontWeight: 500, color: "#333", marginTop: 6 }}>
            {timeAgo(payload.summary.latest_assessed_at)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="co-table-wrap">
        <table className="co-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Layer</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Confidence</th>
              <th>Watch Tickers</th>
              <th style={{ textAlign: "right" }}>Evidence</th>
              <th style={{ textAlign: "right" }}>Assessed</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((item) => (
              <tr
                key={item.node_id}
                className="co-table-row"
                title={item.notes || undefined}
                onClick={() => router.push(`/operator/world?layer=${item.layer_id}&node=${item.node_id}`)}
              >
                <td>
                  <div className="co-name">{item.node_name}</div>
                  <div style={{ fontSize: 11, color: "#bbb", fontFamily: "var(--font-data)" }}>{item.node_id}</div>
                </td>
                <td style={{ fontSize: 13, color: "#444" }}>{item.layer_name ?? `Layer ${item.layer_id}`}</td>
                <td style={{ fontSize: 13, fontWeight: 500, color: statusColor(item.status) }}>{humanize(item.status)}</td>
                <td style={{ fontSize: 13, fontWeight: 500, color: severityColor(item.severity) }}>{humanize(item.severity)}</td>
                <td style={{ fontSize: 13, color: "#444", fontFamily: "var(--font-data)" }}>{humanize(item.confidence)}</td>
                <td>
                  {item.watch_tickers.length > 0 ? (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {item.watch_tickers.map((t) => (
                        <span key={t} className="co-ticker" style={{
                          background: "#f5f5f5", padding: "2px 6px", borderRadius: 3, fontSize: 11,
                        }}>{t}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#ccc", fontSize: 12 }}>--</span>
                  )}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 13, color: "#444" }}>
                  {item.evidence_ref_count ?? item.evidence_refs.length}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                  {timeAgo(item.assessed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
