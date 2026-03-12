"use client";

import { useCallback, useEffect, useState } from "react";

type WorkflowDefinition = {
  workflow_key: string;
  label: string;
  track: string;
  description: string;
  step_count: number;
  automation: {
    supports_scheduling?: boolean;
    default_schedule_kind?: string;
  };
};

type WorkflowCatalogResponse = {
  workflows: WorkflowDefinition[];
  count: number;
};

type WorkflowRun = {
  run_id: string;
  workflow_key: string;
  generated_at: string | null;
  requested_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  requested_by?: string | null;
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

function humanizeKey(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function titleCase(value: string) {
  return humanizeKey(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OperatorRunsApp() {
  const [catalog, setCatalog] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandState, setCommandState] = useState<string | null>(null);

  const loadRun = useCallback(async (runId: string, cancelled = false) => {
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
  }, []);

  const loadCatalog = useCallback(async (cancelled = false) => {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/operator/workflows", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Workflow catalog request failed (${response.status})`);
      }
      const payload = (await response.json()) as WorkflowCatalogResponse;
      if (!cancelled) {
        setCatalog(payload.workflows);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!cancelled) {
        setCatalogLoading(false);
      }
    }
  }, []);

  const loadRuns = useCallback(async (cancelled = false) => {
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
        const nextRunId = selectedRun?.run_id ?? payload.runs[0]?.run_id;
        if (nextRunId) {
          await loadRun(nextRunId, cancelled);
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
  }, [loadRun, selectedRun?.run_id]);

  useEffect(() => {
    let cancelled = false;
    void loadCatalog(cancelled);
    void loadRuns(cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadCatalog, loadRuns]);

  useEffect(() => {
    const hasActiveRun = runs.some((run) => run.status === "queued" || run.status === "running");
    if (!hasActiveRun) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadRuns(false);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loadRuns, runs, selectedRun?.run_id]);

  async function selectRun(runId: string) {
    try {
      await loadRun(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function triggerWorkflow(workflow: WorkflowDefinition) {
    setCommandState(`Starting ${workflow.label}...`);
    setError(null);
    try {
      const response = await fetch("/api/operator/workflows/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow_key: workflow.workflow_key,
        }),
      });
      const payload = (await response.json()) as { detail?: string; run_id?: string };
      if (!response.ok) {
        throw new Error(payload.detail ?? `Workflow trigger failed (${response.status})`);
      }

      setCommandState(`${workflow.label} queued as ${payload.run_id}`);
      await loadRuns();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown workflow error";
      setCommandState(message);
      setError(message);
    }
  }

  const workflowsByTrack = catalog.reduce<Record<string, WorkflowDefinition[]>>((groups, workflow) => {
    const track = workflow.track || "unassigned";
    if (!groups[track]) {
      groups[track] = [];
    }
    groups[track].push(workflow);
    return groups;
  }, {});

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Operator Runs</h1>
      <p style={{ color: "#555", maxWidth: 760 }}>
        Workflow controls are loaded from the engine workflow catalog and grouped by track. The
        portal only renders engine-discovered workflows and passes the selected{" "}
        <code>workflow_key</code> back to the engine.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={() => void loadRuns()}>
          Refresh Runs
        </button>
      </div>
      {commandState ? <p>{commandState}</p> : null}
      {catalogLoading ? <p>Loading workflow catalog…</p> : null}
      {loading ? <p>Loading runs…</p> : null}
      {error ? <p>Failed to load runs: {error}</p> : null}

      <section
        style={{
          border: "1px solid #d8d8d8",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Workflow Catalog</h2>
        {catalog.length === 0 && !catalogLoading ? <p>No workflows found.</p> : null}
        <div style={{ display: "grid", gap: 16 }}>
          {Object.entries(workflowsByTrack)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([track, workflows]) => (
              <section key={track} style={{ display: "grid", gap: 12 }}>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#666",
                    }}
                  >
                    {titleCase(track)}
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  {workflows.map((workflow) => {
                    const activeRun = runs.find(
                      (run) =>
                        run.workflow_key === workflow.workflow_key &&
                        (run.status === "queued" || run.status === "running"),
                    );

                    return (
                      <section
                        key={workflow.workflow_key}
                        style={{
                          border: "1px solid #e6e6e6",
                          borderRadius: 12,
                          padding: 16,
                          background: "#fafafa",
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{workflow.label}</div>
                          <div style={{ marginTop: 4, color: "#666", fontSize: 13 }}>
                            <code>{workflow.workflow_key}</code>
                          </div>
                        </div>
                        <p style={{ margin: 0, color: "#555", lineHeight: 1.5 }}>
                          {workflow.description}
                        </p>
                        <div style={{ fontSize: 13, color: "#666" }}>
                          {workflow.step_count} steps · schedule{" "}
                          {humanizeKey(workflow.automation.default_schedule_kind ?? "manual")}
                          {workflow.automation.supports_scheduling ? "" : " · manual only"}
                        </div>
                        {activeRun ? (
                          <div
                            style={{
                              display: "inline-flex",
                              width: "fit-content",
                              borderRadius: 999,
                              background: "#eef6ff",
                              color: "#0b5ea8",
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Active run {activeRun.run_id}
                          </div>
                        ) : null}
                        <div>
                          <button
                            type="button"
                            onClick={() => void triggerWorkflow(workflow)}
                            disabled={Boolean(activeRun)}
                          >
                            {activeRun ? "Already Running" : `Run ${workflow.label}`}
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
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
                  {run.workflow_key} · {run.status} · {formatTimestamp(run.generated_at)}
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
              <p>Requested by: {selectedRun.requested_by ?? "n/a"}</p>
              <p>Requested at: {formatTimestamp(selectedRun.requested_at)}</p>
              <p>Started at: {formatTimestamp(selectedRun.started_at)}</p>
              <p>Completed at: {formatTimestamp(selectedRun.completed_at)}</p>
              <p>Generated at: {formatTimestamp(selectedRun.generated_at)}</p>
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
