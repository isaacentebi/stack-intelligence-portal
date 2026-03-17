"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, GitBranch, Shield, AlertTriangle, Layers } from "lucide-react";
import {
  WorldModelNode,
  WorldModelSummary,
} from "@/components/operator/world/types";

const LAYER_COLORS: Record<number, string> = {
  1: "#8B7355", 2: "#7A6B50", 3: "#0D7A3E", 4: "#2D8B56",
  5: "#357A5E", 6: "#0B5EA8", 7: "#3A7BBF", 8: "#4A8BC2",
  9: "#6B5B95", 10: "#7A5BA5", 11: "#8B5BA8", 12: "#7A7A9B",
};

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(s: string | undefined | null): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function OperatorWorldModelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const layerParam = searchParams.get("layer");
  const nodeParam = searchParams.get("node");

  const [summary, setSummary] = useState<WorldModelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodePayload, setNodePayload] = useState<WorldModelNode | null>(null);
  const [nodeLoading, setNodeLoading] = useState(false);

  // Load summary
  useEffect(() => {
    fetch("/api/world-model/summary", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load node detail
  useEffect(() => {
    if (!nodeParam) { setNodePayload(null); return; }
    let cancelled = false;
    setNodeLoading(true);
    fetch(`/api/world-model/nodes/${encodeURIComponent(nodeParam)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) setNodePayload(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNodeLoading(false); });
    return () => { cancelled = true; };
  }, [nodeParam]);

  const selectedLayer = useMemo(() =>
    summary?.layers.find((l) => String(l.layer_id) === layerParam) ?? null,
  [summary, layerParam]);

  if (loading) return <div className="op-loading" style={{ minHeight: 400 }}><span className="op-spinner" />Loading…</div>;
  if (error) return <div className="op-error" style={{ margin: 32 }}>{error}</div>;
  if (!summary) return null;

  // View: Node detail
  if (nodeParam && layerParam) {
    return (
      <NodeView
        nodePayload={nodePayload}
        loading={nodeLoading}
        layerParam={layerParam}
        summary={summary}
        onBack={() => router.push(`/operator/world?layer=${layerParam}`)}
        onNavigateNode={(id) => {
          // Find the layer for this node
          const targetLayer = summary.layers.find((l) => l.nodes.some((n) => n.node_id === id));
          router.push(`/operator/world?layer=${targetLayer?.layer_id ?? layerParam}&node=${id}`);
        }}
        onNavigateCompany={(t) => router.push(`/operator/companies/${t}`)}
      />
    );
  }

  // View: Layer detail (nodes)
  if (layerParam && selectedLayer) {
    return (
      <LayerView
        layer={selectedLayer}
        onBack={() => router.push("/operator/world")}
        onSelectNode={(id) => router.push(`/operator/world?layer=${layerParam}&node=${id}`)}
      />
    );
  }

  // View: Stack overview (layers)
  return <StackView summary={summary} onSelectLayer={(id) => router.push(`/operator/world?layer=${id}`)} />;
}

/* ── Stack View ─────────────────────────────────────────── */

function StackView({
  summary,
  onSelectLayer,
}: {
  summary: WorldModelSummary;
  onSelectLayer: (id: number) => void;
}) {
  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="wm-page-title">World Model</h1>
        <p className="wm-page-sub">
          {summary.totals.layer_count} layers · {summary.totals.node_count} nodes · {summary.totals.company_count} companies
        </p>
      </div>
      <div className="wm-layer-grid">
        {summary.layers.map((layer) => {
          const color = LAYER_COLORS[layer.layer_id] ?? "#888";
          const companies = layer.nodes.reduce((s, n) => s + n.company_count, 0);
          return (
            <button
              key={layer.layer_id}
              type="button"
              className="wm-lcard"
              style={{ "--lc": color } as React.CSSProperties}
              onClick={() => onSelectLayer(layer.layer_id)}
            >
              <div className="wm-lcard-num">{layer.layer_id}</div>
              <div className="wm-lcard-body">
                <div className="wm-lcard-name">{layer.name}</div>
                <div className="wm-lcard-meta">
                  {layer.node_count} nodes · {companies} companies
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Layer View ─────────────────────────────────────────── */

function LayerView({
  layer,
  onBack,
  onSelectNode,
}: {
  layer: WorldModelSummary["layers"][number];
  onBack: () => void;
  onSelectNode: (id: string) => void;
}) {
  const color = LAYER_COLORS[layer.layer_id] ?? "#888";

  return (
    <div style={{ padding: "24px 32px" }}>
      <div className="wm-view-header">
        <button type="button" className="wm-view-back" onClick={onBack}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Layers
        </button>
        <div>
          <div className="wm-view-kicker" style={{ color }}>Layer {layer.layer_id}</div>
          <h1 className="wm-page-title">{layer.name}</h1>
          {layer.description && <p className="wm-page-sub">{layer.description}</p>}
          <p className="wm-page-sub">{layer.node_count} nodes · {layer.nodes.reduce((s, n) => s + n.company_count, 0)} companies</p>
        </div>
      </div>
      <div className="wm-ncard-grid">
        {layer.nodes.map((node) => (
          <button
            key={node.node_id}
            type="button"
            className="wm-ncard"
            style={{ "--lc": color } as React.CSSProperties}
            onClick={() => onSelectNode(node.node_id)}
          >
            <div className="wm-ncard-id">{node.node_id}</div>
            <div className="wm-ncard-name">{node.name}</div>
            {node.description && (
              <div className="wm-ncard-desc">
                {node.description.length > 140 ? node.description.slice(0, 140) + "…" : node.description}
              </div>
            )}
            <div className="wm-ncard-meta">
              <span><Building2 style={{ width: 11, height: 11 }} /> {node.company_count} companies</span>
              {node.pending_review_count > 0 && (
                <span style={{ color: "#0B5EA8" }}>{node.pending_review_count} reviews</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Node View ──────────────────────────────────────────── */

function NodeView({
  nodePayload,
  loading,
  layerParam,
  summary,
  onBack,
  onNavigateNode,
  onNavigateCompany,
}: {
  nodePayload: WorldModelNode | null;
  loading: boolean;
  layerParam: string;
  summary: WorldModelSummary;
  onBack: () => void;
  onNavigateNode: (id: string) => void;
  onNavigateCompany: (ticker: string) => void;
}) {
  const [showFullNotes, setShowFullNotes] = useState(false);
  const [nodeCompanies, setNodeCompanies] = useState<any[] | null>(null);

  // Fetch enriched companies (USD-normalized, PE, revenue — one call)
  useEffect(() => {
    if (!nodePayload?.node?.node_id) { setNodeCompanies(null); return; }
    fetch(`/api/world-model/nodes/${encodeURIComponent(nodePayload.node.node_id)}/companies`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setNodeCompanies(data?.companies ?? []))
      .catch(() => setNodeCompanies(null));
  }, [nodePayload]);

  // Build node name lookup from summary
  const nodeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const layer of summary.layers) {
      for (const n of layer.nodes) {
        map.set(n.node_id, n.name);
      }
    }
    return map;
  }, [summary]);

  if (loading) return <div className="op-loading" style={{ minHeight: 300 }}><span className="op-spinner" />Loading node…</div>;
  const node = nodePayload?.node;
  if (!node) return <div className="op-empty" style={{ margin: 32 }}>Node not found.</div>;

  const color = LAYER_COLORS[node.layer_id] ?? "#888";
  const bn = node.bottleneck_profile;
  const moat = node.moat_profile;
  const hasUpstream = (node.adjacency?.upstream?.length ?? 0) > 0;
  const hasDownstream = (node.adjacency?.downstream?.length ?? 0) > 0;

  // Collect all notes
  const allNotes = [bn?.notes, moat?.notes].filter(Boolean).join(" ");

  return (
    <div className="nd">
      {/* Breadcrumb */}
      <div className="nd-nav">
        <button type="button" onClick={onBack}>
          <ArrowLeft style={{ width: 12, height: 12 }} />
          Layer {layerParam}
        </button>
        <span>/</span>
        <span style={{ color }}>{node.node_id}</span>
      </div>

      {/* Title */}
      <h1 className="nd-title">{node.name}</h1>

      {/* Tags line */}
      <div className="nd-tags">
        <span className="nd-tag">{node.layer_name}</span>
        <span className="nd-tag">{node.company_count} companies</span>
        {bn?.is_bottleneck && <span className="nd-tag nd-tag--amber">{capitalize(bn.bottleneck_type)} bottleneck · {capitalize(bn.concentration)} · {capitalize(bn.substitutability)} substitutability</span>}
        {(moat?.primary_moat_types?.length ?? 0) > 0 && (
          <span className="nd-tag nd-tag--green">
            Moat: {moat!.primary_moat_types!.map(humanize).join(", ")} · {capitalize(moat?.moat_durability)}
          </span>
        )}
      </div>

      {/* Description + notes */}
      {(node.description || allNotes) && (
        <div className="nd-prose">
          {node.description && <p>{node.description}</p>}
          {allNotes && (
            <p>
              {showFullNotes ? allNotes : allNotes.slice(0, 300) + (allNotes.length > 300 ? "…" : "")}
              {allNotes.length > 300 && (
                <button type="button" className="nd-more" onClick={() => setShowFullNotes(!showFullNotes)}>
                  {showFullNotes ? "Less" : "More"}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {/* Dependencies — inline links */}
      {(hasUpstream || hasDownstream) && (
        <div className="nd-deps">
          {hasUpstream && (
            <div className="nd-dep-group">
              <span className="nd-dep-label" style={{ color: "#18A055" }}>Upstream</span>
              {node.adjacency!.upstream!.map((d) => (
                <button key={d.node_id} className="nd-dep-chip" onClick={() => onNavigateNode(d.node_id)}>
                  <strong>{d.node_id}</strong> {nodeNameMap.get(d.node_id) ?? ""}
                </button>
              ))}
            </div>
          )}
          {hasDownstream && (
            <div className="nd-dep-group">
              <span className="nd-dep-label" style={{ color: "#0B5EA8" }}>Downstream</span>
              {node.adjacency!.downstream!.map((d) => (
                <button key={d.node_id} className="nd-dep-chip" onClick={() => onNavigateNode(d.node_id)}>
                  <strong>{d.node_id}</strong> {nodeNameMap.get(d.node_id) ?? ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signals — compact list */}
      {(node.signals?.length ?? 0) > 0 && (
        <div className="nd-signals">
          <div className="nd-signals-title">Signals</div>
          {node.signals!.map((s, i) => (
            <div key={i} className="nd-signal">
              <span className="nd-signal-name">{s.name}</span>
              <span className="nd-signal-meta">{capitalize(s.type)}{s.source ? ` · ${s.source}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Companies table */}
      <div className="nd-companies">
        <div className="nd-companies-title">Companies ({node.companies.length})</div>
        {(nodeCompanies ?? []).length > 0 ? (
          <div className="co-fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th className="fin-th-label">Company</th>
                  <th className="fin-th-period">Ticker</th>
                  <th className="fin-th-period">Country</th>
                  <th className="fin-th-period">Mkt Cap (USD)</th>
                  <th className="fin-th-period">Rev TTM (USD)</th>
                  <th className="fin-th-period">Rev Q (USD)</th>
                  <th className="fin-th-period">P/E</th>
                  <th className="fin-th-period">Fwd P/E</th>
                  <th className="fin-th-period">1D</th>
                  <th className="fin-th-period">1W</th>
                  <th className="fin-th-period">1M</th>
                  <th className="fin-th-period">3M</th>
                  <th className="fin-th-period">1Y</th>
                  <th className="fin-th-period">Relevance</th>
                  <th className="fin-th-period">Rev. Exp.</th>
                </tr>
              </thead>
              <tbody>
                {nodeCompanies!
                  .sort((a: any, b: any) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0))
                  .map((c: any) => {
                    const fmtUsd = (v: number | null) => {
                      if (v == null) return "—";
                      const abs = Math.abs(v);
                      if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
                      if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                      if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                      return `$${v.toLocaleString()}`;
                    };
                    const pe = c.pe_ttm;
                    const fwd = c.pe_forward;
                    const peStr = pe != null && pe > 0 && pe < 1000 ? pe.toFixed(1) : "—";
                    const fwdStr = fwd != null && fwd > 0 && fwd < 1000 ? `${fwd.toFixed(1)}` : "—";
                    const fwdYear = c.pe_forward_year ? ` '${String(c.pe_forward_year).replace(/\D/g, "").slice(-2)}` : "";
                    const fmtRet = (v: number | null | undefined) => {
                      if (v == null) return <span style={{ color: "#ccc" }}>—</span>;
                      const color = v > 0 ? "#18A055" : v < 0 ? "#D94040" : "#8B949E";
                      return <span style={{ color, fontFamily: "var(--font-data)", fontSize: 12 }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
                    };

                    return (
                      <tr key={c.ticker} style={{ cursor: "pointer" }} onClick={() => onNavigateCompany(c.ticker)} title={c.role ?? ""}>
                        <td className="fin-td-label fin-td-label--bold">{c.name}</td>
                        <td className="fin-td-value" style={{ color }}>{c.ticker}</td>
                        <td className="fin-td-value">{c.country ?? "—"}</td>
                        <td className="fin-td-value fin-td-value--bold">{fmtUsd(c.market_cap_usd)}</td>
                        <td className="fin-td-value">{fmtUsd(c.revenue_ttm_usd)}</td>
                        <td className="fin-td-value">{fmtUsd(c.revenue_quarterly_usd)}</td>
                        <td className="fin-td-value">{peStr}</td>
                        <td className="fin-td-value">{fwdStr}</td>
                        <td className="fin-td-value">{fmtRet(c.return_1d)}</td>
                        <td className="fin-td-value">{fmtRet(c.return_1w)}</td>
                        <td className="fin-td-value">{fmtRet(c.return_1m)}</td>
                        <td className="fin-td-value">{fmtRet(c.return_3m)}</td>
                        <td className="fin-td-value">{fmtRet(c.return_1y)}</td>
                        <td className="fin-td-value">{capitalize(c.relevance)}</td>
                        <td className="fin-td-value">{capitalize(c.revenue_exposure)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : nodeCompanies === null ? (
          <div className="op-loading"><span className="op-spinner" />Loading companies…</div>
        ) : (
          <div className="op-empty">No companies in this node.</div>
        )}
      </div>
    </div>
  );
}
