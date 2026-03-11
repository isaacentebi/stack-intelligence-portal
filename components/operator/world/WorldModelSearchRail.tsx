"use client";

import { WorldModelSummary } from "@/components/operator/world/types";

type NodeIndexItem = {
  node_id: string;
  name: string;
  description: string;
  layer_id: number;
  layer_name: string;
  company_count: number;
  pending_review_count: number;
  bottleneck_count: number;
  routing_count: number;
};

export function WorldModelSearchRail({
  summary,
  nodes,
  query,
  onQueryChange,
  selectedNodeId,
  onSelectNode,
}: {
  summary: WorldModelSummary;
  nodes: NodeIndexItem[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <aside
      style={{
        background: "#f7faf7",
        padding: 20,
        display: "grid",
        gap: 16,
        alignContent: "start",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#5f6c62" }}>NODE INDEX</div>
        <h1 style={{ margin: 0, fontSize: 24 }}>Operator World Model</h1>
        <p style={{ margin: 0, color: "#516055", fontSize: 14 }}>
          {summary.totals.node_count} nodes across {summary.totals.layer_count} layers. Search by node ID or node name.
        </p>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Find node</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search node ID or name"
          style={{
            width: "100%",
            border: "1px solid #c7d0c8",
            borderRadius: 10,
            padding: "10px 12px",
            background: "#fff",
          }}
        />
      </label>

      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: "calc(100vh - 250px)",
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {nodes.map((node) => {
          const selected = node.node_id === selectedNodeId;
          return (
            <button
              key={node.node_id}
              type="button"
              onClick={() => onSelectNode(node.node_id)}
              style={{
                textAlign: "left",
                border: selected ? "1px solid #0f6a42" : "1px solid #d7ddd6",
                background: selected ? "#eef8f1" : "#fff",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#5f6c62" }}>{node.node_id}</span>
                <span style={{ fontSize: 12, color: "#5f6c62" }}>L{node.layer_id}</span>
              </div>
              <div style={{ fontWeight: 700, color: "#1f2922" }}>{node.name}</div>
              <div style={{ fontSize: 13, color: "#516055" }}>
                {node.company_count} cos · {node.pending_review_count} reviews · {node.bottleneck_count} bottlenecks ·{" "}
                {node.routing_count} routes
              </div>
              <div style={{ fontSize: 12, color: "#708074" }}>{node.layer_name}</div>
            </button>
          );
        })}
        {nodes.length === 0 ? (
          <div style={{ border: "1px dashed #c7d0c8", borderRadius: 12, padding: 16, color: "#516055" }}>
            No nodes match this search.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
