"use client";

import { WorldModelNode } from "@/components/operator/world/types";

export function NodeWorkspace({
  nodePayload,
  loading,
  onSelectNode,
  onSelectCompany,
  selectedCompanyTicker,
}: {
  nodePayload: WorldModelNode | null;
  loading: boolean;
  onSelectNode: (nodeId: string) => void;
  onSelectCompany: (ticker: string) => void;
  selectedCompanyTicker: string | null;
}) {
  const node = nodePayload?.node;

  return (
    <main style={{ padding: 20, display: "grid", gap: 16, alignContent: "start" }}>
      {loading ? <p>Loading node…</p> : null}
      {!loading && !node ? <p>Select a node.</p> : null}
      {node ? (
        <>
          <section
            style={{
              border: "1px solid #d7ddd6",
              borderRadius: 16,
              background: "#fff",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#5f6c62" }}>
                {node.node_id} · {node.layer_name}
              </div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{node.name}</h2>
              <p style={{ margin: 0, color: "#435046", lineHeight: 1.5 }}>{node.description}</p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              <MetricCard label="Companies" value={String(node.company_count)} />
              <MetricCard label="Pending Review" value={String(node.pending_review_count)} />
              <MetricCard label="Version" value={String(node.version ?? "n/a")} />
              <MetricCard label="Updated" value={node.updated_at ?? "n/a"} />
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <SectionTitle title="Scope" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <BulletSection title="Includes" items={node.scope?.includes ?? []} />
                <BulletSection title="Excludes" items={node.scope?.excludes ?? []} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <SectionTitle title="Signals" />
              <div style={{ display: "grid", gap: 10 }}>
                {(node.signals ?? []).map((signal) => (
                  <div
                    key={signal.signal_id ?? signal.name}
                    style={{
                      border: "1px solid #e4e9e4",
                      borderRadius: 10,
                      padding: 12,
                      background: "#f9fbf9",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{signal.name}</div>
                    <div style={{ fontSize: 13, color: "#516055" }}>
                      {signal.type ?? "unknown"} · {signal.source ?? "no source"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section
            style={{
              border: "1px solid #d7ddd6",
              borderRadius: 16,
              background: "#fff",
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <SectionTitle title="Companies In Node" />
            <div style={{ display: "grid", gap: 10 }}>
              {node.companies.map((company) => {
                const selected = selectedCompanyTicker === company.ticker;
                return (
                  <button
                    key={`${node.node_id}:${company.ticker}`}
                    type="button"
                    onClick={() => onSelectCompany(company.ticker)}
                    style={{
                      textAlign: "left",
                      border: selected ? "1px solid #0f6a42" : "1px solid #d7ddd6",
                      borderRadius: 12,
                      background: selected ? "#eef8f1" : "#fff",
                      padding: 12,
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {company.name} <span style={{ color: "#5f6c62" }}>({company.ticker})</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#435046" }}>{company.role ?? "No role summary available."}</div>
                    <div style={{ fontSize: 12, color: "#5f6c62" }}>
                      Relevance {company.relevance ?? "n/a"} · Revenue {company.revenue_exposure ?? "n/a"} · Pending{" "}
                      {company.pending_review_count}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            style={{
              border: "1px solid #d7ddd6",
              borderRadius: 16,
              background: "#fff",
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <SectionTitle title="Dependencies" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DependencySection
                title="Upstream"
                items={node.adjacency?.upstream ?? []}
                onSelectNode={onSelectNode}
              />
              <DependencySection
                title="Downstream"
                items={node.adjacency?.downstream ?? []}
                onSelectNode={onSelectNode}
              />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e4e9e4",
        borderRadius: 12,
        padding: 12,
        background: "#f9fbf9",
      }}
    >
      <div style={{ fontSize: 12, color: "#5f6c62" }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>;
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      style={{
        border: "1px solid #e4e9e4",
        borderRadius: 12,
        padding: 14,
        background: "#f9fbf9",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.length === 0 ? <div style={{ color: "#5f6c62" }}>No entries.</div> : null}
        {items.map((item) => (
          <div key={item} style={{ color: "#435046", fontSize: 14 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencySection({
  title,
  items,
  onSelectNode,
}: {
  title: string;
  items: Array<{
    node_id: string;
    relationship?: string;
    description?: string;
  }>;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e4e9e4",
        borderRadius: 12,
        padding: 14,
        background: "#f9fbf9",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      {items.length === 0 ? <div style={{ color: "#5f6c62" }}>No adjacent nodes.</div> : null}
      {items.map((item) => (
        <button
          key={`${title}:${item.node_id}`}
          type="button"
          onClick={() => onSelectNode(item.node_id)}
          style={{
            textAlign: "left",
            border: "1px solid #d7ddd6",
            borderRadius: 10,
            background: "#fff",
            padding: 10,
            cursor: "pointer",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 600 }}>{item.node_id}</div>
          <div style={{ fontSize: 13, color: "#516055" }}>{item.relationship ?? "adjacent"}</div>
          {item.description ? <div style={{ fontSize: 12, color: "#708074" }}>{item.description}</div> : null}
        </button>
      ))}
    </div>
  );
}
