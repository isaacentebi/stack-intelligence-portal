"use client";

import { useEffect, useState } from "react";

type WorkflowRun = {
  run_id: string;
  workflow_key: string;
  generated_at: string | null;
  status: string;
  step_count: number;
  status_counts: Record<string, number>;
  steps?: Array<{
    step: string;
    status: string;
    output_tail?: string | null;
  }>;
};

type WorkflowRunList = {
  runs: WorkflowRun[];
  count: number;
};

export function OperatorRunsApp() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/operator/workflows/runs?limit=20", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Workflow runs request failed (${response.status})`);
        }
        const payload = (await response.json()) as WorkflowRunList;
        if (!cancelled) {
          setRuns(payload.runs);
          if (payload.runs[0]) {
            void loadRun(payload.runs[0].run_id);
          } else {
            setSelectedRun(null);
          }
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

    async function loadRun(runId: string) {
      const response = await fetch(`/api/operator/workflows/runs/${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Workflow run request failed (${response.status})`);
      }
      const payload = (await response.json()) as WorkflowRun;
      if (!cancelled) {
        setSelectedRun(payload);
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectRun(runId: string) {
    try {
      const response = await fetch(`/api/operator/workflows/runs/${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Workflow run request failed (${response.status})`);
      }
      const payload = (await response.json()) as WorkflowRun;
      setSelectedRun(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Operator Runs</h1>
      {loading ? <p>Loading runs…</p> : null}
      {error ? <p>Failed to load runs: {error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Runs</h2>
          {runs.length === 0 ? <p>No workflow runs found.</p> : null}
          <div style={{ display: "grid", gap: 8 }}>
            {runs.map((run) => (
              <button
                key={run.run_id}
                type="button"
                onClick={() => void selectRun(run.run_id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  border: selectedRun?.run_id === run.run_id ? "1px solid #0b5ea8" : "1px solid #cfcfcf",
                  background: selectedRun?.run_id === run.run_id ? "#eef6ff" : "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>{run.run_id}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {run.workflow_key} · {run.status} · {run.generated_at ?? "n/a"}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Run Detail</h2>
          {!selectedRun ? <p>Select a run.</p> : null}
          {selectedRun ? (
            <>
              <p>Run ID: {selectedRun.run_id}</p>
              <p>Workflow: {selectedRun.workflow_key}</p>
              <p>Status: {selectedRun.status}</p>
              <p>Generated at: {selectedRun.generated_at ?? "n/a"}</p>
              <p>Step count: {selectedRun.step_count}</p>
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {(selectedRun.steps ?? []).map((step, index) => (
                  <section
                    key={`${selectedRun.run_id}:${index}:${step.step}`}
                    style={{ border: "1px solid #ececec", borderRadius: 10, padding: 12 }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {step.step} · {step.status}
                    </div>
                    {step.output_tail ? (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          fontSize: 12,
                          margin: "8px 0 0 0",
                          color: "#555",
                        }}
                      >
                        {step.output_tail}
                      </pre>
                    ) : null}
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
