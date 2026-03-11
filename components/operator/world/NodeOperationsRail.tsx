"use client";

import { CompanyDetailCard } from "@/components/operator/world/CompanyDetailCard";
import {
  BottlenecksResponse,
  CompanyRoutePayload,
  ReviewQueueResponse,
  RoutingLedgerResponse,
  WorldModelNode,
} from "@/components/operator/world/types";

function reviewNodeIds(item: ReviewQueueResponse["items"][number]) {
  return new Set([
    ...(item.retained_node_ids ?? []),
    ...(item.challenged_node_ids ?? []),
    ...(item.proposed_node_ids ?? []),
  ]);
}

export function NodeOperationsRail({
  nodePayload,
  reviews,
  bottlenecks,
  routing,
  selectedCompany,
  companyLoading,
}: {
  nodePayload: WorldModelNode | null;
  reviews: ReviewQueueResponse | null;
  bottlenecks: BottlenecksResponse | null;
  routing: RoutingLedgerResponse | null;
  selectedCompany: CompanyRoutePayload | null;
  companyLoading: boolean;
}) {
  const nodeId = nodePayload?.node.node_id;
  const nodeReviews = nodeId
    ? (reviews?.items ?? []).filter((item) => reviewNodeIds(item).has(nodeId))
    : [];
  const nodeBottlenecks = nodeId
    ? (bottlenecks?.items ?? []).filter((item) => item.node_id === nodeId)
    : [];
  const nodeRoutes = nodeId
    ? (routing?.items ?? []).filter(
        (item) => item.node_id === nodeId || (item.nodes ?? []).some((node) => node.node_id === nodeId),
      )
    : [];

  return (
    <aside
      style={{
        background: "#f8faf8",
        padding: 20,
        display: "grid",
        gap: 16,
        alignContent: "start",
      }}
    >
      <section
        style={{
          border: "1px solid #d7ddd6",
          borderRadius: 14,
          background: "#fff",
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#5f6c62" }}>OPERATIONAL STATE</div>
        <h3 style={{ margin: 0, fontSize: 18 }}>Selected node overlays</h3>
        <div style={{ color: "#516055", fontSize: 14 }}>
          {nodeId ? `Operational context for ${nodeId}` : "Select a node to inspect operator overlays."}
        </div>
      </section>

      <OverlayCard
        title="Pending Reviews"
        emptyMessage="No pending review items for this node."
        items={nodeReviews.map((item) => ({
          key: item.proposal_key,
          title: item.subject_label,
          meta: `${item.entity_type} · ${item.priority ?? "n/a"}`,
          detail: item.review_reason,
        }))}
      />

      <OverlayCard
        title="Bottlenecks"
        emptyMessage="No active bottleneck state for this node."
        items={nodeBottlenecks.map((item, index) => ({
          key: `${item.node_id}:${index}`,
          title: `${item.status ?? "unknown"} · ${item.severity ?? "n/a"}`,
          meta: `confidence ${item.confidence ?? "n/a"} · ${item.assessed_at ?? "n/a"}`,
          detail: item.notes ?? "",
        }))}
      />

      <OverlayCard
        title="Routing"
        emptyMessage="No routing entries for this node."
        items={nodeRoutes.slice(0, 5).map((item) => ({
          key: item.entry_id ?? `${item.node_id}:${item.created_at}`,
          title: `${item.decision ?? "unknown"} · ${item.status ?? "n/a"}`,
          meta: `${item.priority ?? "n/a"} · ${item.created_at ?? "n/a"}`,
          detail: item.notes ?? item.trigger ?? "",
        }))}
      />

      <CompanyDetailCard selectedCompany={selectedCompany} loading={companyLoading} />
    </aside>
  );
}

function OverlayCard({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: Array<{
    key: string;
    title: string;
    meta: string;
    detail: string;
  }>;
}) {
  return (
    <section
      style={{
        border: "1px solid #d7ddd6",
        borderRadius: 14,
        background: "#fff",
        padding: 16,
        display: "grid",
        gap: 10,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
      {items.length === 0 ? <p style={{ margin: 0, color: "#516055" }}>{emptyMessage}</p> : null}
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            border: "1px solid #e4e9e4",
            borderRadius: 10,
            padding: 10,
            background: "#f9fbf9",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 700 }}>{item.title}</div>
          <div style={{ fontSize: 12, color: "#5f6c62" }}>{item.meta}</div>
          {item.detail ? <div style={{ fontSize: 13, color: "#435046" }}>{item.detail}</div> : null}
        </div>
      ))}
    </section>
  );
}
