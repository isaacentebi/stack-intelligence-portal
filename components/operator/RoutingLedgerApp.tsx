"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RoutingItem = {
  entry_id: string;
  created_at: string | null;
  decision: string;
  node_id: string | null;
  node_name: string | null;
  node_ids: string[];
  layer_id: number | null;
  layer_name?: string | null;
  tickers: string[];
  action: string;
  priority: string;
  status: string;
  trigger: string;
  notes: string;
};

type RoutingLedgerResponse = {
  knowledge_revision: string;
  summary: {
    entry_count: number;
    returned_count: number;
    open_count: number;
    by_priority: Record<string, number>;
    by_decision: Record<string, number>;
    latest_created_at: string | null;
    legacy_rows_without_persisted_decision: number;
    decision_normalization_mode: string;
  };
  items: RoutingItem[];
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

function priorityColor(p: string): string {
  if (p === "high" || p === "critical") return "#D94040";
  if (p === "medium") return "#B08415";
  return "#888";
}

function decisionStyle(d: string): { background: string; color: string } {
  if (d === "route") return { background: "#edf7f0", color: "#18A055" };
  return { background: "#f5f5f5", color: "#888" };
}

export function RoutingLedgerApp() {
  const router = useRouter();
  const [payload, setPayload] = useState<RoutingLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/operator/routing/ledger?limit=100", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d) => setPayload(d as RoutingLedgerResponse))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed to load routing ledger: {error}</div>;
  if (!payload) return null;

  const { entry_count, by_priority } = payload.summary;
  const highCount = by_priority?.high ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Routing</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {entry_count} entries · {highCount} high priority
          </div>
        </div>
        <button type="button" onClick={load} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>
          Refresh
        </button>
      </div>

      {/* Summary metrics */}
      <div className="co-panel-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="co-panel">
          <div className="co-panel-title">Total Entries</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{entry_count}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Open</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: "#111" }}>{payload.summary.open_count}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">High Priority</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, color: highCount > 0 ? "#D94040" : "#111" }}>{highCount}</div>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Latest Entry</div>
          <div style={{ fontSize: 16, fontFamily: "var(--font-data)", fontWeight: 500, color: "#333", marginTop: 6 }}>
            {timeAgo(payload.summary.latest_created_at)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="co-table-wrap">
        <table className="co-table">
          <thead>
            <tr>
              <th>Entry ID</th>
              <th>Node</th>
              <th>Decision</th>
              <th>Priority</th>
              <th>Tickers</th>
              <th style={{ textAlign: "right" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((item) => (
              <tr
                key={item.entry_id}
                className="co-table-row"
                onClick={() => {
                  if (item.node_id && item.layer_id != null) {
                    router.push(`/operator/world?layer=${item.layer_id}&node=${item.node_id}`);
                  }
                }}
              >
                <td style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                  {item.entry_id.length > 12 ? item.entry_id.slice(-8) : item.entry_id}
                </td>
                <td>
                  {item.node_name ? (
                    <>
                      <div className="co-name">{item.node_name}</div>
                      <div style={{ fontSize: 11, color: "#bbb", fontFamily: "var(--font-data)" }}>{item.node_id}</div>
                    </>
                  ) : (
                    <span style={{ color: "#ccc", fontSize: 12 }}>--</span>
                  )}
                </td>
                <td>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 3,
                    fontSize: 12,
                    fontWeight: 500,
                    ...decisionStyle(item.decision),
                  }}>
                    {humanize(item.decision)}
                  </span>
                </td>
                <td style={{ fontSize: 13, fontWeight: 500, color: priorityColor(item.priority) }}>
                  {humanize(item.priority)}
                </td>
                <td>
                  {item.tickers.length > 0 ? (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {item.tickers.map((t) => (
                        <span key={t} className="co-ticker" style={{
                          background: "#f5f5f5", padding: "2px 6px", borderRadius: 3, fontSize: 11,
                        }}>{t}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#ccc", fontSize: 12 }}>--</span>
                  )}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                  {timeAgo(item.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
