import Link from "next/link";
import { fetchEngineJson, getEngineApiBaseUrl } from "@/lib/engine-api";

type OperatorStatusResponse = {
  knowledge_revision: string;
  bundle: {
    bundle_version: string;
    source_commit: string | null;
    created_at: string | null;
  };
  latest_workflow_run: {
    run_id: string;
    generated_at: string | null;
    step_count: number;
    status_counts: Record<string, number>;
  } | null;
  refresh_queues: {
    refresh_queue: {
      queue_count: number;
      generated_at: string | null;
      priority_counts: Record<string, number>;
    };
    event_queue: {
      queue_count: number;
      generated_at: string | null;
    };
    node_watch_queue: {
      queue_count: number;
      generated_at: string | null;
      priority_counts: Record<string, number>;
    };
    company_freshness: {
      company_count: number;
      needs_refresh_count: number;
      generated_at: string | null;
    };
  };
  review_queue: {
    queue_count: number;
    generated_at: string | null;
    decision_count: number;
    latest_reviewed_at: string | null;
  };
  bottlenecks: {
    active_count: number;
    binding_count: number;
    latest_assessed_at: string | null;
  };
  routing: {
    entry_count: number;
    open_count: number;
    latest_created_at: string | null;
  };
};

export default async function ResearchGatewayStatusPage() {
  const apiBaseUrl = getEngineApiBaseUrl();

  let status: OperatorStatusResponse | null = null;
  let error: string | null = null;

  try {
    const { response, payload } = await fetchEngineJson<OperatorStatusResponse>(
      "/v1/operator/status",
    );
    if (!response.ok) {
      throw new Error(`Engine request failed (${response.status})`);
    }
    status = payload;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown engine error";
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px" }}>
      <h1>Operator Status</h1>
      <p>
        API base URL: <code>{apiBaseUrl}</code>
      </p>

      {error ? (
        <section>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <p>
            Make sure the engine API is running:
            <br />
            <code>python3 -m uvicorn engine_api.app:app --host 127.0.0.1 --port 8000</code>
          </p>
        </section>
      ) : (
        <section>
          <h2>Connected</h2>
          <p>Knowledge revision: {status?.knowledge_revision}</p>
          <p>Bundle version: {status?.bundle.bundle_version}</p>
          <p>Bundle commit: {status?.bundle.source_commit ?? "n/a"}</p>
          <p>Bundle created at: {status?.bundle.created_at ?? "n/a"}</p>
          <p>Latest workflow run: {status?.latest_workflow_run?.run_id ?? "n/a"}</p>
          <p>Latest workflow generated at: {status?.latest_workflow_run?.generated_at ?? "n/a"}</p>
          <p>Workflow steps: {status?.latest_workflow_run?.step_count ?? 0}</p>
          <p>Refresh queue count: {status?.refresh_queues.refresh_queue.queue_count ?? 0}</p>
          <p>Event queue count: {status?.refresh_queues.event_queue.queue_count ?? 0}</p>
          <p>Node watch queue count: {status?.refresh_queues.node_watch_queue.queue_count ?? 0}</p>
          <p>Companies needing refresh: {status?.refresh_queues.company_freshness.needs_refresh_count ?? 0}</p>
          <p>Review queue count: {status?.review_queue.queue_count ?? 0}</p>
          <p>Review decisions recorded: {status?.review_queue.decision_count ?? 0}</p>
          <p>Bottlenecks active: {status?.bottlenecks.active_count ?? 0}</p>
          <p>Routing entries: {status?.routing.entry_count ?? 0}</p>
          <p>Routing open: {status?.routing.open_count ?? 0}</p>
          <p>
            Try API directly:{" "}
            <a href={`${apiBaseUrl}/v1/operator/status`} target="_blank" rel="noreferrer">
              /v1/operator/status
            </a>
          </p>
          <p>
            <Link href="/research-dashboard/reviews">Review Queue</Link>
            {" · "}
            <Link href="/research-dashboard/world">World Model</Link>
          </p>
        </section>
      )}

      <p style={{ marginTop: 24 }}>
        <Link href="/research-dashboard">Back to Research Dashboard</Link>
      </p>
    </main>
  );
}
