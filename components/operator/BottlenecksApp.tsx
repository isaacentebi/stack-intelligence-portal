"use client";

import { useEffect, useState } from "react";

type BottlenecksResponse = {
  knowledge_revision: string;
  summary: {
    active_count: number;
    binding_count: number;
    by_status: Record<string, number>;
    by_severity: Record<string, number>;
    latest_assessed_at: string | null;
  };
  items: Array<{
    node_id: string;
    node_name: string;
    layer_id: number;
    status: string;
    severity: string;
    confidence: string;
    assessed_at: string | null;
    watch_tickers: string[];
    evidence_refs: string[];
    notes: string;
  }>;
};

export function BottlenecksApp() {
  const [payload, setPayload] = useState<BottlenecksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/operator/bottlenecks/active", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Bottlenecks request failed (${response.status})`);
        }
        const result = (await response.json()) as BottlenecksResponse;
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
      <h1>Bottleneck Operator View</h1>
      {loading ? <p>Loading bottlenecks…</p> : null}
      {error ? <p>Failed to load bottlenecks: {error}</p> : null}

      {payload ? (
        <>
          <p>Knowledge revision: {payload.knowledge_revision}</p>
          <p>Active assessments: {payload.summary.active_count}</p>
          <p>Binding assessments: {payload.summary.binding_count}</p>
          <p>Latest assessed at: {payload.summary.latest_assessed_at ?? "n/a"}</p>

          <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
            {payload.items.map((item) => (
              <section
                key={item.node_id}
                style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}
              >
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                  Node {item.node_id} · Layer {item.layer_id} · {item.status} / {item.severity} /{" "}
                  {item.confidence}
                </p>
                <h2 style={{ margin: "8px 0" }}>{item.node_name}</h2>
                <p style={{ margin: "8px 0" }}>{item.notes}</p>
                <p style={{ margin: "8px 0", fontSize: 12, color: "#666" }}>
                  Assessed at: {item.assessed_at ?? "n/a"} · Watch tickers:{" "}
                  {item.watch_tickers.length > 0 ? item.watch_tickers.join(", ") : "none"} · Evidence refs:{" "}
                  {item.evidence_refs.length}
                </p>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
