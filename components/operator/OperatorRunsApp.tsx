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

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function humanize(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function statusColor(s: string): string {
  if (s === "completed" || s === "resolved") return "#18A055";
  if (s === "failed" || s === "critical") return "#D94040";
  if (s === "running" || s === "queued") return "#0B5EA8";
  return "#444";
}

export function OperatorRunsApp() {
  const [catalog, setCatalog] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, runsRes] = await Promise.all([
        fetch("/api/operator/workflows", { cache: "no-store" }),
        fetch("/api/operator/workflows/runs?limit=20", { cache: "no-store" }),
      ]);
      if (!catRes.ok) throw new Error(`Catalog failed (${catRes.status})`);
      if (!runsRes.ok) throw new Error(`Runs failed (${runsRes.status})`);
      const catData = (await catRes.json()) as { workflows: WorkflowDefinition[] };
      const runsData = (await runsRes.json()) as { runs: WorkflowRun[] };
      setCatalog(catData.workflows);
      setRuns(runsData.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function selectRun(runId: string) {
    try {
      const r = await fetch(`/api/operator/workflows/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      setSelectedRun((await r.json()) as WorkflowRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" /></div>;
  if (error) return <div className="op-error" style={{ margin: 20 }}>Failed to load workflows: {error}</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Workflows</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {catalog.length} workflows · {runs.length} recent runs
          </div>
        </div>
        <button type="button" onClick={() => void loadAll()} className="fin-btn fin-btn--on" style={{ padding: "6px 16px" }}>
          Refresh
        </button>
      </div>

      {/* Workflow Catalog */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa", marginBottom: 10 }}>
          Workflow Catalog
        </div>
        <div className="co-table-wrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Track</th>
                <th style={{ textAlign: "right" }}>Steps</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((w) => (
                <tr key={w.workflow_key} className="co-table-row">
                  <td>
                    <div className="co-name">{w.label}</div>
                    <div style={{ fontSize: 11, color: "#bbb", fontFamily: "var(--font-data)", marginTop: 1 }}>{w.workflow_key}</div>
                  </td>
                  <td style={{ fontSize: 13, color: "#444" }}>{humanize(w.track)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 13, color: "#444" }}>{w.step_count}</td>
                  <td style={{ fontSize: 13, color: "#444" }}>
                    {humanize(w.automation.default_schedule_kind ?? "manual")}
                    {!w.automation.supports_scheduling && (
                      <span style={{ fontSize: 11, color: "#bbb", marginLeft: 6 }}>manual only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Runs */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa", marginBottom: 10 }}>
          Recent Runs
        </div>
        {runs.length === 0 ? (
          <div style={{ border: "1px solid #e5e5e5", padding: "32px 24px", textAlign: "center", fontSize: 13, color: "#888" }}>
            No workflow runs found.
          </div>
        ) : (
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Steps</th>
                  <th style={{ textAlign: "right" }}>Requested</th>
                  <th style={{ textAlign: "right" }}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.run_id}
                    className="co-table-row"
                    onClick={() => void selectRun(run.run_id)}
                    style={{ background: selectedRun?.run_id === run.run_id ? "#f8faf8" : undefined }}
                  >
                    <td style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                      {run.run_id.length > 12 ? run.run_id.slice(-8) : run.run_id}
                    </td>
                    <td style={{ fontSize: 13, color: "#444" }}>{humanize(run.workflow_key)}</td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 500, color: statusColor(run.status) }}>
                        {humanize(run.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 13, color: "#444" }}>{run.step_count}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                      {timeAgo(run.requested_at)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-data)", fontSize: 12, color: "#888" }}>
                      {timeAgo(run.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Detail Panel */}
      {selectedRun && (
        <div style={{ border: "1px solid #e5e5e5", padding: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3, color: "#aaa" }}>
              Run Detail
            </div>
            <button type="button" onClick={() => setSelectedRun(null)} style={{
              all: "unset", cursor: "pointer", fontSize: 12, color: "#888",
            }}>Close</button>
          </div>

          <table className="co-data-table" style={{ marginBottom: 16 }}>
            <tbody>
              <tr><td className="co-dt-label">Run ID</td><td className="co-dt-value" style={{ textAlign: "left" }}>{selectedRun.run_id}</td></tr>
              <tr><td className="co-dt-label">Workflow</td><td className="co-dt-value" style={{ textAlign: "left" }}>{humanize(selectedRun.workflow_key)}</td></tr>
              <tr>
                <td className="co-dt-label">Status</td>
                <td className="co-dt-value" style={{ textAlign: "left", color: statusColor(selectedRun.status) }}>{humanize(selectedRun.status)}</td>
              </tr>
              <tr><td className="co-dt-label">Requested</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(selectedRun.requested_at)}</td></tr>
              <tr><td className="co-dt-label">Completed</td><td className="co-dt-value" style={{ textAlign: "left" }}>{timeAgo(selectedRun.completed_at)}</td></tr>
              <tr><td className="co-dt-label">Steps</td><td className="co-dt-value" style={{ textAlign: "left" }}>{selectedRun.step_count}</td></tr>
            </tbody>
          </table>

          {selectedRun.steps && selectedRun.steps.length > 0 && (
            <div className="co-table-wrap">
              <table className="co-table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Status</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRun.steps.map((step, i) => (
                    <tr key={`${selectedRun.run_id}-${i}`}>
                      <td style={{ fontSize: 13, color: "#444" }}>{step.step}</td>
                      <td style={{ fontSize: 13, fontWeight: 500, color: statusColor(step.status) }}>{humanize(step.status)}</td>
                      <td style={{ fontSize: 12, color: "#888", fontFamily: "var(--font-data)", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {step.output_tail ?? "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
