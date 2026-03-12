"use client";

import { useEffect, useState } from "react";

type OperatorStatusResponse = {
  knowledge_revision: string;
  canon: {
    knowledge_revision: string | null;
    quality_state: "fresh" | "degraded" | "stale_bundle" | "missing_bundle";
    bundle_age_seconds: number | null;
    last_successful_sync_time: string | null;
    reasons: {
      missing_bundle: string[];
      stale_bundle: string[];
      degraded: string[];
    };
  };
  bundle: {
    bundle_version: string;
    source_commit: string | null;
    created_at: string | null;
  };
  latest_workflow_run: {
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
  } | null;
  refresh_queues: {
    refresh_queue: {
      generated_at: string | null;
      analysis_date?: string | null;
      queue_count: number;
      priority_counts?: Record<string, number>;
    };
    event_queue: {
      generated_at: string | null;
      queue_count: number;
    };
    node_watch_queue: {
      generated_at: string | null;
      analysis_date?: string | null;
      queue_count: number;
      priority_counts?: Record<string, number>;
    };
    company_freshness: {
      generated_at: string | null;
      analysis_date?: string | null;
      company_count: number;
      needs_refresh_count: number;
      status_counts: Record<string, number>;
      actual_coverage_status_counts?: Record<string, number>;
    };
  };
  review_queue: {
    queue_count: number;
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
  bridge: {
    available: boolean;
    run_count: number;
  };
  valuations: {
    available: boolean;
    run_count: number;
    ingestion_failure_count: number;
    feedback_entry_count: number;
  };
};

type OperatorHealthResponse = {
  status: string;
  ready: boolean;
  knowledge_revision: string;
  canon: {
    quality_state: "fresh" | "degraded" | "stale_bundle" | "missing_bundle";
  };
  checks: Record<
    string,
    {
      status: string;
      latest_snapshot?: string | null;
      path?: string | null;
    }
  >;
};

type PublicationsListResponse = {
  publications: Array<{
    publication_id: string;
    status: string;
    knowledge_revision: string;
    published_at: string | null;
    source_commit: string | null;
  }>;
};

type SurfaceTone = "good" | "warn" | "bad";

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

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function humanizeKey(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function titleCase(value: string) {
  return humanizeKey(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function toneStyles(tone: SurfaceTone) {
  if (tone === "good") {
    return {
      border: "1px solid #b9e6c7",
      background: "#f3fff7",
      accent: "#1d7a37",
      pillBackground: "#ddf7e6",
    };
  }
  if (tone === "bad") {
    return {
      border: "1px solid #f2b8b5",
      background: "#fff3f2",
      accent: "#a1251b",
      pillBackground: "#ffe1de",
    };
  }
  return {
    border: "1px solid #f1d48b",
    background: "#fffaf0",
    accent: "#8c5b00",
    pillBackground: "#fdecc8",
  };
}

function KeyMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #ececec",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>{value}</div>
      {detail ? <div style={{ marginTop: 6, color: "#555" }}>{detail}</div> : null}
    </div>
  );
}

function SurfaceCard({
  tone,
  state,
  title,
  summary,
  detail,
}: {
  tone: SurfaceTone;
  state: string;
  title: string;
  summary: string;
  detail: string;
}) {
  const styles = toneStyles(tone);

  return (
    <section
      style={{
        ...styles,
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          padding: "4px 10px",
          background: styles.pillBackground,
          color: styles.accent,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {state}
      </div>
      <h2 style={{ margin: "14px 0 8px 0", fontSize: 20 }}>{title}</h2>
      <p style={{ margin: 0, fontWeight: 600 }}>{summary}</p>
      <p style={{ margin: "8px 0 0 0", color: "#555", lineHeight: 1.5 }}>{detail}</p>
    </section>
  );
}

export function OperatorStatusApp() {
  const [status, setStatus] = useState<OperatorStatusResponse | null>(null);
  const [health, setHealth] = useState<OperatorHealthResponse | null>(null);
  const [publication, setPublication] = useState<PublicationsListResponse["publications"][number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [statusResponse, healthResponse, publicationsResponse] = await Promise.all([
          fetch("/api/operator/status", { cache: "no-store" }),
          fetch("/api/operator/health", { cache: "no-store" }),
          fetch("/api/operator/publications", { cache: "no-store" }),
        ]);

        if (!statusResponse.ok) {
          throw new Error(`Operator status request failed (${statusResponse.status})`);
        }
        if (!healthResponse.ok) {
          throw new Error(`Operator health request failed (${healthResponse.status})`);
        }
        if (!publicationsResponse.ok) {
          throw new Error(`Publications request failed (${publicationsResponse.status})`);
        }

        const [nextStatus, nextHealth, nextPublications] = (await Promise.all([
          statusResponse.json(),
          healthResponse.json(),
          publicationsResponse.json(),
        ])) as [OperatorStatusResponse, OperatorHealthResponse, PublicationsListResponse];

        if (!cancelled) {
          setStatus(nextStatus);
          setHealth(nextHealth);
          setPublication(nextPublications.publications[0] ?? null);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const degradedChecks = Object.entries(health?.checks ?? {})
    .filter(([, value]) => value.status !== "ok")
    .map(([key]) => titleCase(key));
  const coverageLimitedCount =
    status?.refresh_queues.company_freshness.actual_coverage_status_counts?.coverage_limited ??
    status?.refresh_queues.company_freshness.status_counts.coverage_limited ??
    0;
  const valueAgentAvailable = Boolean(status?.bridge.available || status?.valuations.available);
  const canonState = status?.canon.quality_state ?? "missing_bundle";
  const runtimeState = health?.ready ? "ready" : "not_ready";
  const canonReasons =
    canonState === "missing_bundle"
      ? status?.canon.reasons.missing_bundle
      : canonState === "stale_bundle"
        ? status?.canon.reasons.stale_bundle
        : status?.canon.reasons.degraded;

  return (
    <main style={{ maxWidth: 1180, margin: "40px auto", padding: "0 24px 48px 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-end",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Operator Status</h1>
          <p style={{ margin: 0, color: "#555", maxWidth: 720 }}>
            Engine-driven operator health, bundle freshness, coverage pressure, and bridge/value-agent
            handoff visibility. No portal-only workflow or quality state is inferred beyond these
            engine read models.
          </p>
        </div>
        <button type="button" onClick={() => window.location.reload()}>
          Refresh Status
        </button>
      </div>

      {loading ? <p>Loading operator status…</p> : null}
      {error ? <p>Failed to load operator status: {error}</p> : null}

      {!loading && !error && status && health ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <SurfaceCard
              tone={
                canonState === "missing_bundle" || canonState === "stale_bundle"
                  ? "bad"
                  : canonState === "degraded"
                    ? "warn"
                    : "good"
              }
              state={canonState}
              title="Canonical Bundle"
              summary={
                canonState === "missing_bundle"
                  ? "The engine does not have an active canonical bundle."
                  : canonState === "stale_bundle"
                    ? "The active canonical bundle is stale or does not match the workspace."
                    : canonState === "degraded"
                      ? "The active canonical bundle is present but marked degraded."
                      : "The active canonical bundle is current."
              }
              detail={`Knowledge revision ${status.canon.knowledge_revision ?? status.knowledge_revision}. Last successful sync ${formatTimestamp(
                status.canon.last_successful_sync_time ?? publication?.published_at ?? status.bundle.created_at,
              )}.${canonReasons && canonReasons.length > 0 ? ` Reasons: ${canonReasons.join(", ")}.` : ""}`}
            />
            <SurfaceCard
              tone={health?.ready ? "good" : "bad"}
              state={runtimeState}
              title="Runtime Health"
              summary={
                health?.ready
                  ? "Operator readiness checks are passing."
                  : "Operator readiness is degraded."
              }
              detail={
                degradedChecks.length > 0
                  ? `Degraded checks: ${degradedChecks.join(", ")}.`
                  : "Knowledge bundle, snapshots, review queue, refresh queue, and routing ledger are healthy."
              }
            />
            <SurfaceCard
              tone={coverageLimitedCount > 0 ? "warn" : "good"}
              state={coverageLimitedCount > 0 ? "coverage_limited" : "fresh"}
              title="Coverage Quality"
              summary={
                coverageLimitedCount > 0
                  ? `${formatCountLabel(coverageLimitedCount, "company")} are flagged as coverage limited.`
                  : "No companies are currently marked coverage limited."
              }
              detail={`${formatCountLabel(
                status.refresh_queues.company_freshness.needs_refresh_count,
                "company",
              )} need refresh across ${formatCountLabel(
                status.refresh_queues.company_freshness.company_count,
                "tracked company",
              )}. Analysis date ${status.refresh_queues.company_freshness.analysis_date ?? "n/a"}.`}
            />
            <SurfaceCard
              tone={valueAgentAvailable ? "good" : "warn"}
              state={valueAgentAvailable ? "handoff visible" : "handoff parked"}
              title="Bridge / Value-Agent"
              summary={
                valueAgentAvailable
                  ? "Bridge or valuation handoff records are available to inspect."
                  : "No bridge or valuation handoff records are currently available from engine."
              }
              detail={`${formatCountLabel(status.bridge.run_count, "bridge run")} and ${formatCountLabel(
                status.valuations.run_count,
                "valuation run",
              )}. Ingestion failures: ${status.valuations.ingestion_failure_count}.`}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <KeyMetric
              label="Refresh Queue"
              value={String(status.refresh_queues.refresh_queue.queue_count)}
              detail={`Generated ${formatTimestamp(status.refresh_queues.refresh_queue.generated_at)}`}
            />
            <KeyMetric
              label="Node Watch"
              value={String(status.refresh_queues.node_watch_queue.queue_count)}
              detail={`Generated ${formatTimestamp(status.refresh_queues.node_watch_queue.generated_at)}`}
            />
            <KeyMetric
              label="Review Queue"
              value={String(status.review_queue.queue_count)}
              detail={`${status.review_queue.decision_count} decisions recorded`}
            />
            <KeyMetric
              label="Open Routing"
              value={String(status.routing.open_count)}
              detail={`${status.routing.entry_count} total routing entries`}
            />
            <KeyMetric
              label="Binding Bottlenecks"
              value={String(status.bottlenecks.binding_count)}
              detail={`${status.bottlenecks.active_count} active assessments`}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <section
              style={{
                border: "1px solid #d8d8d8",
                borderRadius: 16,
                padding: 20,
                background: "#fff",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Latest Workflow Run</h2>
              {!status.latest_workflow_run ? <p>No workflow run found.</p> : null}
              {status.latest_workflow_run ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={{ margin: 0 }}>
                    <strong>{status.latest_workflow_run.workflow_key}</strong> ·{" "}
                    {status.latest_workflow_run.status}
                  </p>
                  <p style={{ margin: 0 }}>Run ID: {status.latest_workflow_run.run_id}</p>
                  <p style={{ margin: 0 }}>
                    Generated: {formatTimestamp(status.latest_workflow_run.generated_at)}
                  </p>
                  <p style={{ margin: 0 }}>Steps: {status.latest_workflow_run.step_count}</p>
                  <p style={{ margin: 0 }}>
                    Status counts:{" "}
                    {Object.entries(status.latest_workflow_run.status_counts)
                      .map(([key, value]) => `${humanizeKey(key)} ${value}`)
                      .join(", ") || "n/a"}
                  </p>
                </div>
              ) : null}
            </section>

            <section
              style={{
                border: "1px solid #d8d8d8",
                borderRadius: 16,
                padding: 20,
                background: "#fff",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Bundle Metadata</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0 }}>Knowledge revision: {status.knowledge_revision}</p>
                <p style={{ margin: 0 }}>Bundle version: {status.bundle.bundle_version}</p>
                <p style={{ margin: 0 }}>
                  Source commit: {publication?.source_commit ?? status.bundle.source_commit ?? "n/a"}
                </p>
                <p style={{ margin: 0 }}>
                  Bundle created: {formatTimestamp(status.bundle.created_at)}
                </p>
                <p style={{ margin: 0 }}>
                  Last review decision: {formatTimestamp(status.review_queue.latest_reviewed_at)}
                </p>
                <p style={{ margin: 0 }}>
                  Last bottleneck assessment: {formatTimestamp(status.bottlenecks.latest_assessed_at)}
                </p>
                <p style={{ margin: 0 }}>
                  Last routing entry: {formatTimestamp(status.routing.latest_created_at)}
                </p>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}
