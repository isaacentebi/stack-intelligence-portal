"use client";

import { CompanyRoutePayload } from "@/components/operator/world/types";

export function CompanyDetailCard({
  selectedCompany,
  loading,
}: {
  selectedCompany: CompanyRoutePayload | null;
  loading: boolean;
}) {
  return (
    <section
      style={{
        border: "1px solid #d7ddd6",
        borderRadius: 14,
        background: "#fff",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#5f6c62" }}>COMPANY DETAIL</div>
        <h3 style={{ margin: "6px 0 0 0", fontSize: 18 }}>Selected company</h3>
      </div>

      {loading ? <p style={{ margin: 0 }}>Loading company detail…</p> : null}
      {!loading && !selectedCompany ? (
        <p style={{ margin: 0, color: "#516055" }}>Select a company from the current node to inspect its other node appearances.</p>
      ) : null}
      {selectedCompany ? (
        <>
          <div style={{ fontWeight: 700 }}>{selectedCompany.company}</div>
          <div style={{ fontSize: 13, color: "#516055" }}>
            Appears in {selectedCompany.nodeCount} nodes.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {selectedCompany.appearances.map((appearance) => (
              <div
                key={`${selectedCompany.company}:${appearance.nodeId}`}
                style={{
                  border: "1px solid #e4e9e4",
                  borderRadius: 10,
                  padding: 10,
                  background: "#f9fbf9",
                }}
              >
                <div style={{ fontSize: 12, color: "#5f6c62" }}>
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
  );
}
