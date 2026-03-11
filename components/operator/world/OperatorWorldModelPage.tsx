"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NodeOperationsRail } from "@/components/operator/world/NodeOperationsRail";
import { NodeWorkspace } from "@/components/operator/world/NodeWorkspace";
import { WorldModelSearchRail } from "@/components/operator/world/WorldModelSearchRail";
import {
  BottlenecksResponse,
  CompanyRoutePayload,
  ReviewQueueResponse,
  RoutingLedgerResponse,
  WorldModelNode,
  WorldModelSummary,
} from "@/components/operator/world/types";

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

export function OperatorWorldModelPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedNodeId = searchParams.get("node");
  const selectedCompanyTicker = searchParams.get("company");
  const initialSelectedNodeIdRef = useRef(selectedNodeId);

  const [summary, setSummary] = useState<WorldModelSummary | null>(null);
  const [nodePayload, setNodePayload] = useState<WorldModelNode | null>(null);
  const [reviews, setReviews] = useState<ReviewQueueResponse | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottlenecksResponse | null>(null);
  const [routing, setRouting] = useState<RoutingLedgerResponse | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyRoutePayload | null>(null);
  const [query, setQuery] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingNode, setLoadingNode] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSelection = useCallback(
    (nodeId: string, companyTicker: string | null, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("node", nodeId);
      if (companyTicker) {
        params.set("company", companyTicker);
      } else {
        params.delete("company");
      }
      const nextUrl = `${pathname}?${params.toString()}`;
      if (replace) {
        router.replace(nextUrl);
        return;
      }
      router.push(nextUrl);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      setLoadingSummary(true);
      setError(null);
      try {
        const [summaryResponse, reviewsResponse, bottleneckResponse, routingResponse] = await Promise.all([
          fetch("/api/world-model/summary", { cache: "no-store" }),
          fetch("/api/operator/reviews/queue", { cache: "no-store" }),
          fetch("/api/operator/bottlenecks/active", { cache: "no-store" }),
          fetch("/api/operator/routing/ledger?limit=100", { cache: "no-store" }),
        ]);

        if (!summaryResponse.ok) {
          throw new Error(`Summary request failed (${summaryResponse.status})`);
        }
        if (!reviewsResponse.ok) {
          throw new Error(`Review overlay request failed (${reviewsResponse.status})`);
        }
        if (!bottleneckResponse.ok) {
          throw new Error(`Bottleneck overlay request failed (${bottleneckResponse.status})`);
        }
        if (!routingResponse.ok) {
          throw new Error(`Routing overlay request failed (${routingResponse.status})`);
        }

        const [summaryPayload, reviewsPayload, bottleneckPayload, routingPayload] = await Promise.all([
          summaryResponse.json() as Promise<WorldModelSummary>,
          reviewsResponse.json() as Promise<ReviewQueueResponse>,
          bottleneckResponse.json() as Promise<BottlenecksResponse>,
          routingResponse.json() as Promise<RoutingLedgerResponse>,
        ]);

        if (cancelled) {
          return;
        }

        setSummary(summaryPayload);
        setReviews(reviewsPayload);
        setBottlenecks(bottleneckPayload);
        setRouting(routingPayload);

        const fallbackNodeId = summaryPayload.layers[0]?.nodes[0]?.node_id ?? null;
        if (!initialSelectedNodeIdRef.current && fallbackNodeId) {
          updateSelection(fallbackNodeId, null, true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown world-model error");
        }
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [updateSelection]);

  useEffect(() => {
    if (!selectedNodeId) {
      setNodePayload(null);
      return;
    }
    const nodeId = selectedNodeId;

    let cancelled = false;

    async function loadNode() {
      setLoadingNode(true);
      setSelectedCompany(null);
      try {
        const response = await fetch(`/api/world-model/nodes/${encodeURIComponent(nodeId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Node request failed (${response.status})`);
        }
        const payload = (await response.json()) as WorldModelNode;
        if (!cancelled) {
          setNodePayload(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown node error");
        }
      } finally {
        if (!cancelled) {
          setLoadingNode(false);
        }
      }
    }

    void loadNode();
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedCompanyTicker) {
      setSelectedCompany(null);
      return;
    }
    const companyTicker = selectedCompanyTicker;

    let cancelled = false;

    async function loadCompany() {
      setCompanyLoading(true);
      try {
        const response = await fetch(`/api/world-model/company/${encodeURIComponent(companyTicker)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Company request failed (${response.status})`);
        }
        const payload = (await response.json()) as CompanyRoutePayload;
        if (!cancelled) {
          setSelectedCompany(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown company error");
        }
      } finally {
        if (!cancelled) {
          setCompanyLoading(false);
        }
      }
    }

    void loadCompany();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyTicker]);

  const nodeIndex = useMemo<NodeIndexItem[]>(() => {
    if (!summary) {
      return [];
    }

    const bottleneckCounts = new Map<string, number>();
    for (const item of bottlenecks?.items ?? []) {
      bottleneckCounts.set(item.node_id, (bottleneckCounts.get(item.node_id) ?? 0) + 1);
    }

    const routingCounts = new Map<string, number>();
    for (const item of routing?.items ?? []) {
      const nodeIds = new Set<string>();
      if (item.node_id) {
        nodeIds.add(item.node_id);
      }
      for (const node of item.nodes ?? []) {
        nodeIds.add(node.node_id);
      }
      for (const nodeId of nodeIds) {
        routingCounts.set(nodeId, (routingCounts.get(nodeId) ?? 0) + 1);
      }
    }

    return summary.layers.flatMap((layer) =>
      layer.nodes.map((node) => ({
        ...node,
        layer_id: layer.layer_id,
        layer_name: layer.name,
        bottleneck_count: bottleneckCounts.get(node.node_id) ?? 0,
        routing_count: routingCounts.get(node.node_id) ?? 0,
      })),
    );
  }, [summary, bottlenecks, routing]);

  const filteredNodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return nodeIndex;
    }
    return nodeIndex.filter(
      (node) =>
        node.node_id.toLowerCase().includes(normalized) ||
        node.name.toLowerCase().includes(normalized) ||
        node.layer_name.toLowerCase().includes(normalized),
    );
  }, [nodeIndex, query]);

  useEffect(() => {
    if (!summary || !selectedNodeId) {
      return;
    }
    const exists = nodeIndex.some((node) => node.node_id === selectedNodeId);
    if (!exists && nodeIndex[0]) {
      updateSelection(nodeIndex[0].node_id, null, true);
    }
  }, [summary, nodeIndex, selectedNodeId, updateSelection]);

  return (
    <section
      style={{
        minHeight: "calc(100vh - 120px)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        background: "#eef3ee",
        borderTop: "1px solid #d7ddd6",
      }}
    >
      {loadingSummary ? <div style={{ padding: 24 }}>Loading world model…</div> : null}
      {error ? <div style={{ padding: 24, color: "#7b1e1e" }}>Failed to load world model: {error}</div> : null}
      {summary ? (
        <>
          <WorldModelSearchRail
            summary={summary}
            nodes={filteredNodes}
            query={query}
            onQueryChange={setQuery}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId) => updateSelection(nodeId, null)}
          />
          <NodeWorkspace
            nodePayload={nodePayload}
            loading={loadingNode}
            onSelectNode={(nodeId) => updateSelection(nodeId, null)}
            onSelectCompany={(ticker) => updateSelection(selectedNodeId ?? nodePayload?.node.node_id ?? "", ticker)}
            selectedCompanyTicker={selectedCompanyTicker}
          />
          <NodeOperationsRail
            nodePayload={nodePayload}
            reviews={reviews}
            bottlenecks={bottlenecks}
            routing={routing}
            selectedCompany={selectedCompany}
            companyLoading={companyLoading}
          />
        </>
      ) : null}
    </section>
  );
}
