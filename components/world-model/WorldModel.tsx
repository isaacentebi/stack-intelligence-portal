"use client";

import { useEffect, useState } from "react";

type WorldModelSummary = {
  knowledge_revision: string;
  taxonomy_version?: string;
  totals: {
    layer_count: number;
    node_count: number;
    company_count: number;
    company_node_count: number;
    pending_review_count: number;
  };
  layers: Array<{
    layer_id: number;
    name: string;
    description: string;
    node_count: number;
    nodes: Array<{
      node_id: string;
      name: string;
      description: string;
      company_count: number;
      pending_review_count: number;
    }>;
  }>;
};

type WorldModelNode = {
  knowledge_revision: string;
  node: {
    node_id: string;
    name: string;
    description: string;
    layer_id: number;
    layer_name: string;
    pending_review_count: number;
    company_count: number;
    companies: Array<{
      ticker: string;
      name: string;
      role?: string;
      relevance?: string;
      revenue_exposure?: string;
      pending_review_count: number;
    }>;
  };
};

type CompanyRoutePayload = {
  company: string;
  appearances: Array<{
    layerId: number;
    layerName: string;
    nodeId: string;
    nodeTitle: string;
  }>;
  nodeCount: number;
};

export function WorldModel({ embedded = false }: { embedded?: boolean }) {
  const [summary, setSummary] = useState<WorldModelSummary | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorldModelNode | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyRoutePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/world-model/summary", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Summary request failed (${response.status})`);
        }
        const payload = (await response.json()) as WorldModelSummary;
        if (!cancelled) {
          setSummary(payload);
          const firstNodeId = payload.layers[0]?.nodes[0]?.node_id ?? null;
          setSelectedNodeId(firstNodeId);
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

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNode(null);
      return;
    }
    const nodeId = selectedNodeId;

    let cancelled = false;

    async function loadNode() {
      setNodeLoading(true);
      try {
        const response = await fetch(`/api/world-model/nodes/${encodeURIComponent(nodeId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Node request failed (${response.status})`);
        }
        const payload = (await response.json()) as WorldModelNode;
        if (!cancelled) {
          setSelectedNode(payload);
          setSelectedCompany(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setNodeLoading(false);
        }
      }
    }

    void loadNode();
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  async function loadCompany(ticker: string) {
    setCompanyLoading(true);
    try {
      const response = await fetch(`/api/world-model/company/${encodeURIComponent(ticker)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Company request failed (${response.status})`);
      }
      const payload = (await response.json()) as CompanyRoutePayload;
      setSelectedCompany(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCompanyLoading(false);
    }
  }

  return (
    <section
      style={{
        padding: embedded ? 16 : 24,
        display: "grid",
        gap: 16,
        background: "#faf8f2",
        minHeight: embedded ? "100%" : "100vh",
      }}
    >
      <header
        style={{
          border: "1px solid #d9d2c3",
          borderRadius: 16,
          padding: 16,
          background: "#fffdf8",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.08em", color: "#7b6f5a" }}>
          LIVE WORLD MODEL
        </p>
        <h1 style={{ margin: "8px 0 12px 0", fontSize: embedded ? 24 : 32 }}>World Model</h1>
        <p style={{ margin: 0, color: "#5d5548" }}>
          Canon and overlays now load from engine APIs rather than static slide truth.
        </p>
        {summary ? (
          <p style={{ margin: "12px 0 0 0", color: "#5d5548" }}>
            {summary.totals.layer_count} layers · {summary.totals.node_count} nodes ·{" "}
            {summary.totals.company_count} companies · pending reviews {summary.totals.pending_review_count}
          </p>
        ) : null}
      </header>

      {loading ? <p>Loading world model…</p> : null}
      {error ? <p>Failed to load world model: {error}</p> : null}

      {summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: embedded ? "1fr" : "minmax(320px, 420px) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div
            style={{
              border: "1px solid #d9d2c3",
              borderRadius: 16,
              padding: 16,
              background: "#fffdf8",
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            {summary.layers.map((layer) => (
              <section key={layer.layer_id} style={{ borderTop: "1px solid #ece3d3", paddingTop: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  L{layer.layer_id} · {layer.name}
                </h2>
                <p style={{ margin: "6px 0 10px 0", fontSize: 14, color: "#5d5548" }}>
                  {layer.description}
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {layer.nodes.map((node) => (
                    <button
                      key={node.node_id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.node_id)}
                      style={{
                        textAlign: "left",
                        border: selectedNodeId === node.node_id ? "1px solid #0b5ea8" : "1px solid #d9d2c3",
                        background: selectedNodeId === node.node_id ? "#eef6ff" : "#ffffff",
                        borderRadius: 12,
                        padding: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#7b6f5a" }}>{node.node_id}</div>
                      <div style={{ fontWeight: 600 }}>{node.name}</div>
                      <div style={{ fontSize: 13, color: "#5d5548", marginTop: 4 }}>
                        {node.company_count} companies · pending reviews {node.pending_review_count}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section
              style={{
                border: "1px solid #d9d2c3",
                borderRadius: 16,
                padding: 16,
                background: "#fffdf8",
              }}
            >
              {nodeLoading ? <p>Loading node…</p> : null}
              {selectedNode ? (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: "#7b6f5a" }}>
                    {selectedNode.node.node_id} · {selectedNode.node.layer_name}
                  </p>
                  <h2 style={{ margin: "8px 0 12px 0" }}>{selectedNode.node.name}</h2>
                  <p style={{ margin: 0, color: "#5d5548" }}>{selectedNode.node.description}</p>
                  <p style={{ margin: "12px 0 0 0", color: "#5d5548" }}>
                    {selectedNode.node.company_count} companies · pending reviews {selectedNode.node.pending_review_count}
                  </p>

                  <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                    {selectedNode.node.companies.map((company) => (
                      <button
                        key={`${selectedNode.node.node_id}:${company.ticker}`}
                        type="button"
                        onClick={() => void loadCompany(company.ticker)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #d9d2c3",
                          background: "#ffffff",
                          borderRadius: 12,
                          padding: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {company.name} <span style={{ color: "#7b6f5a" }}>({company.ticker})</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#5d5548", marginTop: 4 }}>
                          {company.role ?? "No role summary"}
                        </div>
                        <div style={{ fontSize: 12, color: "#7b6f5a", marginTop: 4 }}>
                          Relevance {company.relevance ?? "n/a"} · Revenue {company.revenue_exposure ?? "n/a"}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section
              style={{
                border: "1px solid #d9d2c3",
                borderRadius: 16,
                padding: 16,
                background: "#fffdf8",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Company Appearances</h2>
              {companyLoading ? <p>Loading company…</p> : null}
              {!companyLoading && !selectedCompany ? <p>Select a company to inspect its live node appearances.</p> : null}
              {selectedCompany ? (
                <>
                  <p style={{ margin: "0 0 12px 0", color: "#5d5548" }}>
                    {selectedCompany.company} appears in {selectedCompany.nodeCount} nodes.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedCompany.appearances.map((appearance) => (
                      <div
                        key={`${selectedCompany.company}:${appearance.nodeId}`}
                        style={{ border: "1px solid #ece3d3", borderRadius: 12, padding: 12 }}
                      >
                        <div style={{ fontSize: 12, color: "#7b6f5a" }}>
                          L{appearance.layerId} · {appearance.layerName}
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {appearance.nodeId} · {appearance.nodeTitle}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
