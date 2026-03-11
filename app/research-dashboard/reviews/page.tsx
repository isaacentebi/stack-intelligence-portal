import Link from "next/link";
import { fetchEngineJson, getEngineApiBaseUrl } from "@/lib/engine-api";

type ReviewQueueResponse = {
  knowledge_revision: string;
  generated_at: string | null;
  summary: {
    queue_count?: number;
    by_priority?: Record<string, number>;
    by_entity_type?: Record<string, number>;
  };
  items: Array<{
    proposal_key: string;
    entity_type: string;
    subject_key: string;
    subject_label: string;
    priority: string;
    review_reason: string;
    current_summary: string;
    proposed_summary: string;
    freshest_evidence_at?: string | null;
  }>;
  recent_decisions: {
    count: number;
    latest_reviewed_at: string | null;
  };
};

export default async function ResearchReviewQueuePage() {
  const apiBaseUrl = getEngineApiBaseUrl();
  let payload: ReviewQueueResponse | null = null;
  let error: string | null = null;

  try {
    const result = await fetchEngineJson<ReviewQueueResponse>("/v1/operator/reviews/queue");
    if (!result.response.ok) {
      throw new Error(`Engine request failed (${result.response.status})`);
    }
    payload = result.payload;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown engine error";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Review Queue</h1>
      <p>
        Engine API: <code>{apiBaseUrl}</code>
      </p>

      {error ? <p>{error}</p> : null}

      {!error && payload ? (
        <>
          <p>Knowledge revision: {payload.knowledge_revision}</p>
          <p>Queue generated at: {payload.generated_at ?? "n/a"}</p>
          <p>Open reviews: {payload.summary.queue_count ?? 0}</p>
          <p>Recorded decisions: {payload.recent_decisions.count}</p>
          <p>Latest decision: {payload.recent_decisions.latest_reviewed_at ?? "n/a"}</p>

          {payload.items.length === 0 ? (
            <p>No pending review items.</p>
          ) : (
            <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
              {payload.items.map((item) => (
                <section
                  key={item.proposal_key}
                  style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                    {item.entity_type} · {item.priority}
                  </p>
                  <h2 style={{ margin: "8px 0" }}>{item.subject_label}</h2>
                  <p style={{ margin: "8px 0" }}>
                    <strong>Reason:</strong> {item.review_reason}
                  </p>
                  <p style={{ margin: "8px 0" }}>
                    <strong>Current:</strong> {item.current_summary}
                  </p>
                  <p style={{ margin: "8px 0" }}>
                    <strong>Proposed:</strong> {item.proposed_summary}
                  </p>
                  <p style={{ margin: "8px 0", fontSize: 12, color: "#666" }}>
                    Subject key: {item.subject_key} · Freshest evidence: {item.freshest_evidence_at ?? "n/a"}
                  </p>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}

      <p style={{ marginTop: 24 }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/world">World Model</Link>
      </p>
    </main>
  );
}
