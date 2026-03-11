"use client";

import { useEffect, useState } from "react";

type PublicationsListResponse = {
  knowledge_revision: string;
  count: number;
  publications: Array<{
    publication_id: string;
    knowledge_revision: string;
    status: string;
    bundle_version: string;
    bundle_kind?: string;
    created_at: string | null;
    source_commit: string | null;
    included_path_count: number;
    manifest_path: string;
    layer_mapping_version?: string;
    taxonomy_version?: string;
  }>;
};

type PublicationDetailResponse = {
  publication_id: string;
  knowledge_revision: string;
  status: string;
  bundle: {
    bundle_kind: string;
    bundle_version: string;
    created_at: string | null;
    source_commit: string | null;
    manifest_path: string;
    included_paths: string[];
    included_path_count: number;
    contract_versions: Record<string, string>;
    checksum_count: number;
  };
  layer_mapping_manifest: {
    path: string;
    schema_version?: string;
    version?: string;
    created?: string;
    updated?: string;
    taxonomy_version?: string;
    layer_count?: number;
    node_count?: number;
    company_count?: number;
  };
};

export function PublicationsApp() {
  const [payload, setPayload] = useState<PublicationsListResponse | null>(null);
  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPublications() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/operator/publications", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Publications request failed (${response.status})`);
        }
        const result = (await response.json()) as PublicationsListResponse;
        if (!cancelled) {
          setPayload(result);
          setSelectedPublicationId(result.publications[0]?.publication_id ?? null);
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

    void loadPublications();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPublicationId) {
      setDetail(null);
      return;
    }
    const publicationId = selectedPublicationId;

    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/operator/publications/${encodeURIComponent(publicationId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`Publication detail request failed (${response.status})`);
        }
        const result = (await response.json()) as PublicationDetailResponse;
        if (!cancelled) {
          setDetail(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedPublicationId]);

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Publications</h1>
      {loading ? <p>Loading publications…</p> : null}
      {error ? <p>Failed to load publications: {error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Known Publications</h2>
          <p>Count: {payload?.count ?? 0}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {(payload?.publications ?? []).map((publication) => (
              <button
                key={publication.publication_id}
                type="button"
                onClick={() => setSelectedPublicationId(publication.publication_id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  border:
                    selectedPublicationId === publication.publication_id
                      ? "1px solid #0b5ea8"
                      : "1px solid #cfcfcf",
                  background:
                    selectedPublicationId === publication.publication_id ? "#eef6ff" : "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>{publication.knowledge_revision}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {publication.status} · {publication.created_at ?? "n/a"}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ border: "1px solid #d8d8d8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Publication Detail</h2>
          {detailLoading ? <p>Loading detail…</p> : null}
          {!detail && !detailLoading ? <p>Select a publication.</p> : null}
          {detail ? (
            <>
              <p>Knowledge revision: {detail.knowledge_revision}</p>
              <p>Bundle version: {detail.bundle.bundle_version}</p>
              <p>Bundle kind: {detail.bundle.bundle_kind}</p>
              <p>Created at: {detail.bundle.created_at ?? "n/a"}</p>
              <p>Source commit: {detail.bundle.source_commit ?? "n/a"}</p>
              <p>Included paths: {detail.bundle.included_path_count}</p>
              <p>Checksums: {detail.bundle.checksum_count}</p>
              <p>Layer mapping version: {detail.layer_mapping_manifest.version ?? "n/a"}</p>
              <p>Taxonomy version: {detail.layer_mapping_manifest.taxonomy_version ?? "n/a"}</p>
              <p>Node count: {detail.layer_mapping_manifest.node_count ?? 0}</p>
              <p>Company count: {detail.layer_mapping_manifest.company_count ?? 0}</p>
              <div style={{ marginTop: 16 }}>
                <strong>Included paths</strong>
                <ul>
                  {detail.bundle.included_paths.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
