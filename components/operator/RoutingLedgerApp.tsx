"use client";

import { useEffect, useState } from "react";

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
  items: Array<{
    entry_id: string;
    created_at: string | null;
    accepted_at?: string | null;
    decision: string;
    node_ids: string[];
    node_id: string | null;
    node_name: string | null;
    layer_id: number | null;
    tickers: string[];
    action: string;
    priority: string;
    status: string;
    trigger: string;
    notes: string;
  }>;
};

export function RoutingLedgerApp() {
  const [payload, setPayload] = useState<RoutingLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/operator/routing/ledger?limit=100", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Routing ledger request failed (${response.status})`);
        }
        const result = (await response.json()) as RoutingLedgerResponse;
        if (!cancelled) {
          setPayload(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Routing Operator View</h1>
      {loading ? <p>Loading routing ledger…</p> : null}
      {error ? <p>Failed to load routing ledger: {error}</p> : null}

      {payload ? (
        <>
          <p>Knowledge revision: {payload.knowledge_revision}</p>
          <p>Ledger entries: {payload.summary.entry_count}</p>
          <p>Open entries: {payload.summary.open_count}</p>
          <p>Latest created at: {payload.summary.latest_created_at ?? "n/a"}</p>
          <p>Legacy rows without persisted decision: {payload.summary.legacy_rows_without_persisted_decision}</p>
          <p style={{ fontSize: 12, color: "#666" }}>{payload.summary.decision_normalization_mode}</p>

          <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
            {payload.items.map((item) => (
              <section
                key={item.entry_id}
                style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}
              >
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                  {item.entry_id} · {item.decision} · {item.priority} · {item.status}
                </p>
                <h2 style={{ margin: "8px 0" }}>
                  {item.node_id ?? "n/a"} {item.node_name ?? ""}
                </h2>
                <p style={{ margin: "8px 0" }}>
                  <strong>Action:</strong> {item.action}
                </p>
                <p style={{ margin: "8px 0" }}>
                  <strong>Trigger:</strong> {item.trigger}
                </p>
                <p style={{ margin: "8px 0" }}>{item.notes}</p>
                <p style={{ margin: "8px 0", fontSize: 12, color: "#666" }}>
                  Created at: {item.created_at ?? "n/a"} · Accepted at: {item.accepted_at ?? "n/a"} ·
                  Tickers: {item.tickers.length > 0 ? item.tickers.join(", ") : "none"}
                </p>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
