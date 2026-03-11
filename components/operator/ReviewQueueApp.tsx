"use client";

import { useEffect, useState } from "react";

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

export function ReviewQueueApp() {
  const [payload, setPayload] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewedBy, setReviewedBy] = useState("portal:operator");
  const [validate, setValidate] = useState(false);
  const [notesByProposal, setNotesByProposal] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<Record<string, string>>({});

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operator/reviews/queue", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Review queue request failed (${response.status})`);
      }
      const data = (await response.json()) as ReviewQueueResponse;
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function handleAction(proposalKey: string, action: "accept" | "reject" | "dismiss") {
    setActionState((prev) => ({ ...prev, [proposalKey]: `${action}...` }));
    setError(null);
    try {
      const response = await fetch(`/api/operator/reviews/${encodeURIComponent(proposalKey)}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewed_by: reviewedBy,
          notes: notesByProposal[proposalKey] ?? "",
          validate,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail ?? result.error ?? `Action failed (${response.status})`);
      }
      setActionState((prev) => ({
        ...prev,
        [proposalKey]: `${action} recorded as ${result.decision_id}`,
      }));
      await loadQueue();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setActionState((prev) => ({ ...prev, [proposalKey]: message }));
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Review Queue</h1>
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #d8d8d8",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>Reviewed by</span>
          <input
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #cfcfcf" }}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            checked={validate}
            onChange={(event) => setValidate(event.target.checked)}
            type="checkbox"
          />
          Run merge validation when accepting
        </label>
      </div>

      {loading ? <p>Loading review queue…</p> : null}
      {error ? <p>Failed to load review queue: {error}</p> : null}

      {payload ? (
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

                  <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                    <span>Notes</span>
                    <textarea
                      value={notesByProposal[item.proposal_key] ?? ""}
                      onChange={(event) =>
                        setNotesByProposal((prev) => ({
                          ...prev,
                          [item.proposal_key]: event.target.value,
                        }))
                      }
                      rows={3}
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #cfcfcf" }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => void handleAction(item.proposal_key, "accept")}>
                      Accept
                    </button>
                    <button type="button" onClick={() => void handleAction(item.proposal_key, "reject")}>
                      Reject
                    </button>
                    <button type="button" onClick={() => void handleAction(item.proposal_key, "dismiss")}>
                      Dismiss
                    </button>
                  </div>

                  {actionState[item.proposal_key] ? (
                    <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
                      {actionState[item.proposal_key]}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
