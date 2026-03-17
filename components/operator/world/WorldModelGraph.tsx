"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { WorldModelSummary, WorldModelNode } from "@/components/operator/world/types";

const LAYER_COLORS = [
  "var(--primary)",       // L1 green
  "var(--secondary)",     // L2 blue
  "var(--ext-1)",         // L3 brown
  "var(--ext-3)",         // L4 gray-purple
  "var(--primary-light)", // L5
  "var(--secondary-light)", // L6
];

function layerColor(index: number) {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}

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

type Edge = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  direction: "upstream" | "downstream";
};

function bezierPath(edge: Edge): string {
  const dx = edge.toX - edge.fromX;
  const dy = edge.toY - edge.fromY;
  const cx = Math.abs(dx) * 0.3;
  const cy = Math.abs(dy) * 0.5;
  return `M ${edge.fromX} ${edge.fromY} C ${edge.fromX + cx} ${edge.fromY + cy}, ${edge.toX - cx} ${edge.toY - cy}, ${edge.toX} ${edge.toY}`;
}

const NodeCard = memo(function NodeCard({
  node,
  indexItem,
  selected,
  adjacent,
  layerIdx,
  onSelect,
  nodeRef,
}: {
  node: { node_id: string; name: string; company_count: number; pending_review_count: number };
  indexItem?: NodeIndexItem;
  selected: boolean;
  adjacent: boolean;
  layerIdx: number;
  onSelect: (id: string) => void;
  nodeRef: (el: HTMLButtonElement | null) => void;
}) {
  const classes = [
    "wm-node",
    selected && "wm-node--selected",
    adjacent && "wm-node--adjacent",
  ].filter(Boolean).join(" ");

  const companyCount = node.company_count;
  const reviewCount = indexItem?.pending_review_count ?? node.pending_review_count;
  const bottleneckCount = indexItem?.bottleneck_count ?? 0;
  const routingCount = indexItem?.routing_count ?? 0;

  return (
    <button
      ref={nodeRef}
      type="button"
      className={classes}
      style={{ "--layer-color": layerColor(layerIdx) } as React.CSSProperties}
      onClick={() => onSelect(node.node_id)}
    >
      <span className="wm-node-id">{node.node_id}</span>
      <span className="wm-node-name">{node.name}</span>
      <div className="wm-node-badges">
        {companyCount > 0 && <span className="wm-badge wm-badge--co">{companyCount} co</span>}
        {reviewCount > 0 && <span className="wm-badge wm-badge--rv">{reviewCount} rv</span>}
        {bottleneckCount > 0 && <span className="wm-badge wm-badge--bn">{bottleneckCount} bn</span>}
        {routingCount > 0 && <span className="wm-badge wm-badge--rt">{routingCount} rt</span>}
      </div>
    </button>
  );
});

export function WorldModelGraph({
  summary,
  nodeIndex,
  selectedNodeId,
  nodePayload,
  onSelectNode,
  query,
}: {
  summary: WorldModelSummary;
  nodeIndex: NodeIndexItem[];
  selectedNodeId: string | null;
  nodePayload: WorldModelNode | null;
  onSelectNode: (nodeId: string) => void;
  query: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const setNodeRef = useCallback((nodeId: string) => (el: HTMLButtonElement | null) => {
    if (el) {
      nodeRefs.current.set(nodeId, el);
    } else {
      nodeRefs.current.delete(nodeId);
    }
  }, []);

  // Build the set of adjacent node IDs for highlighting
  const adjacentNodeIds = new Set<string>();
  if (nodePayload?.node.adjacency) {
    for (const u of nodePayload.node.adjacency.upstream ?? []) {
      adjacentNodeIds.add(u.node_id);
    }
    for (const d of nodePayload.node.adjacency.downstream ?? []) {
      adjacentNodeIds.add(d.node_id);
    }
  }

  // Build index map for quick lookup
  const indexMap = new Map<string, NodeIndexItem>();
  for (const item of nodeIndex) {
    indexMap.set(item.node_id, item);
  }

  // Query-based filtering: which nodes match the search
  const matchingNodeIds = new Set<string>();
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    for (const item of nodeIndex) {
      if (
        item.node_id.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.layer_name.toLowerCase().includes(normalizedQuery)
      ) {
        matchingNodeIds.add(item.node_id);
      }
    }
  }

  // Recalculate edge positions
  useEffect(() => {
    if (!nodePayload?.node.adjacency || !containerRef.current) {
      setEdges([]);
      return;
    }

    // Small delay to allow DOM to settle after selection change
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newEdges: Edge[] = [];

      const selectedEl = nodeRefs.current.get(nodePayload.node.node_id);
      if (!selectedEl) {
        setEdges([]);
        return;
      }

      const selectedRect = selectedEl.getBoundingClientRect();
      const toX = selectedRect.left + selectedRect.width / 2 - containerRect.left;
      const toY = selectedRect.top + selectedRect.height / 2 - containerRect.top;

      for (const upstream of nodePayload.node.adjacency?.upstream ?? []) {
        const fromEl = nodeRefs.current.get(upstream.node_id);
        if (fromEl) {
          const fromRect = fromEl.getBoundingClientRect();
          newEdges.push({
            fromX: fromRect.left + fromRect.width / 2 - containerRect.left,
            fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
            toX,
            toY,
            direction: "upstream",
          });
        }
      }

      for (const downstream of nodePayload.node.adjacency?.downstream ?? []) {
        const el = nodeRefs.current.get(downstream.node_id);
        if (el) {
          const rect = el.getBoundingClientRect();
          newEdges.push({
            fromX: toX,
            fromY: toY,
            toX: rect.left + rect.width / 2 - containerRect.left,
            toY: rect.top + rect.height / 2 - containerRect.top,
            direction: "downstream",
          });
        }
      }

      setEdges(newEdges);
      setContainerSize({
        width: containerRect.width,
        height: containerRect.height,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [nodePayload]);

  // Observe resize to update edge positions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="wm-graph" ref={containerRef}>
      {/* SVG edge overlay */}
      {edges.length > 0 && (
        <svg
          className="wm-edge-svg"
          width={containerSize.width}
          height={containerSize.height}
          viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        >
          {edges.map((edge, i) => (
            <path
              key={i}
              d={bezierPath(edge)}
              className={`wm-edge-path wm-edge-path--visible wm-edge-path--${edge.direction}`}
            />
          ))}
        </svg>
      )}

      <div className="wm-graph-inner">
        {summary.layers.map((layer, layerIdx) => {
          const color = layerColor(layerIdx);
          const hasMatchingNodes = !normalizedQuery || layer.nodes.some(n => matchingNodeIds.has(n.node_id));

          if (!hasMatchingNodes) return null;

          return (
            <div className="wm-layer" key={layer.layer_id}>
              <div
                className="wm-layer-label"
                style={{ "--layer-color": color } as React.CSSProperties}
              >
                <span className="wm-layer-id">Layer {layer.layer_id}</span>
                <span className="wm-layer-name">{layer.name}</span>
                <span className="wm-layer-count">
                  {layer.node_count} nodes
                </span>
              </div>
              <div className="wm-layer-nodes">
                {layer.nodes.map((node) => {
                  if (normalizedQuery && !matchingNodeIds.has(node.node_id)) return null;
                  const selected = node.node_id === selectedNodeId;
                  const adjacent = adjacentNodeIds.has(node.node_id) && !selected;
                  return (
                    <NodeCard
                      key={node.node_id}
                      node={node}
                      indexItem={indexMap.get(node.node_id)}
                      selected={selected}
                      adjacent={adjacent}
                      layerIdx={layerIdx}
                      onSelect={onSelectNode}
                      nodeRef={setNodeRef(node.node_id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
