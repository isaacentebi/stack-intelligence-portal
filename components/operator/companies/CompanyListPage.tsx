"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Layers } from "lucide-react";

type CompanySummary = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  country: string;
  market_cap: number | null;
  price: number | null;
  priority: string;
  coverage_target: string;
  node_count: number;
  tags: string[];
  pe_ttm: number | null;
  pe_forward: number | null;
  pe_forward_year: string | null;
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_1y: number | null;
};

type SortKey = "market_cap" | "name" | "ticker" | "node_count" | "sector";
type SortDir = "asc" | "desc";

function formatMarketCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function formatPrice(v: number | null): string {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

function priorityBadgeClass(p: string): string {
  if (p === "critical" || p === "high") return "op-badge--bad";
  if (p === "medium" || p === "standard") return "op-badge--warn";
  return "op-badge--neutral";
}

export function CompanyListPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("market_cap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadCompanies = useCallback(async (searchTerm: string, sector: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (sector) params.set("sector", sector);
      params.set("limit", "200");
      const res = await fetch(`/api/companies?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load companies (${res.status})`);
      const data = await res.json();
      setCompanies(data.companies ?? []);
      setTotalCount(data.total_count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCompanies(search, sectorFilter);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, sectorFilter, loadCompanies]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const c of companies) if (c.sector) s.add(c.sector);
    return Array.from(s).sort();
  }, [companies]);

  const sorted = useMemo(() => {
    const copy = [...companies];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "market_cap") cmp = (a.market_cap ?? 0) - (b.market_cap ?? 0);
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "node_count") cmp = a.node_count - b.node_count;
      else if (sortKey === "sector") cmp = (a.sector ?? "").localeCompare(b.sector ?? "");
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [companies, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "ticker" || key === "sector" ? "asc" : "desc");
    }
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <button
        type="button"
        className="co-sort-btn"
        onClick={() => toggleSort(field)}
      >
        {label}
        <ArrowUpDown style={{ width: 12, height: 12, opacity: active ? 1 : 0.3 }} />
        {active && <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  return (
    <div className="co-page">
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, margin: 0 }}>Companies</h1>
          <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#aaa", margin: "4px 0 0" }}>
            {totalCount} companies tracked · {sectors.length} sectors
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            style={{ fontFamily: "var(--font-body)", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, padding: "6px 10px", background: "#fff", color: "#333", width: 180 }}
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          >
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search ticker or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontFamily: "var(--font-body)", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, padding: "6px 12px", background: "#fff", color: "#333", width: 220 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="co-content">
        {loading && (
          <div className="op-loading"><span className="op-spinner" />Loading companies…</div>
        )}
        {error && (
          <div className="op-error" style={{ margin: 20 }}>{error}</div>
        )}
        {!loading && !error && (
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}><SortHeader label="Ticker" field="ticker" /></th>
                  <th><SortHeader label="Company" field="name" /></th>
                  <th style={{ width: 100 }}><SortHeader label="Sector" field="sector" /></th>
                  <th style={{ width: 100 }}><SortHeader label="Mkt Cap" field="market_cap" /></th>
                  <th style={{ width: 65 }}>P/E</th>
                  <th style={{ width: 65 }}>Fwd P/E</th>
                  <th style={{ width: 55 }}>1D</th>
                  <th style={{ width: 55 }}>1W</th>
                  <th style={{ width: 55 }}>1M</th>
                  <th style={{ width: 55 }}>3M</th>
                  <th style={{ width: 55 }}>1Y</th>
                  <th style={{ width: 50 }}><SortHeader label="Nodes" field="node_count" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const fmtRet = (v: number | null) => {
                    if (v == null) return <span style={{ color: "#ccc" }}>—</span>;
                    const color = v > 0 ? "#18A055" : v < 0 ? "#D94040" : "#8B949E";
                    return <span style={{ color, fontFamily: "var(--font-data)", fontSize: 12 }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
                  };
                  const fmtPe = (v: number | null) => {
                    if (v == null || v <= 0 || v > 1000) return "—";
                    return v.toFixed(1);
                  };
                  return (
                    <tr
                      key={c.ticker}
                      className="co-table-row"
                      onClick={() => router.push(`/operator/companies/${c.ticker}`)}
                    >
                      <td className="co-ticker">{c.ticker}</td>
                      <td>
                        <div className="co-name">{c.name}</div>
                        <div className="co-industry">{c.sector} · {c.exchange}</div>
                      </td>
                      <td className="co-sector">{c.sector}</td>
                      <td className="co-mcap">{formatMarketCap(c.market_cap)}</td>
                      <td className="co-price">{fmtPe(c.pe_ttm)}</td>
                      <td className="co-price">{fmtPe(c.pe_forward)}</td>
                      <td style={{ textAlign: "right" }}>{fmtRet(c.return_1d)}</td>
                      <td style={{ textAlign: "right" }}>{fmtRet(c.return_1w)}</td>
                      <td style={{ textAlign: "right" }}>{fmtRet(c.return_1m)}</td>
                      <td style={{ textAlign: "right" }}>{fmtRet(c.return_3m)}</td>
                      <td style={{ textAlign: "right" }}>{fmtRet(c.return_1y)}</td>
                      <td className="co-nodes">
                        {c.node_count > 0 ? c.node_count : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="op-empty" style={{ margin: 20 }}>No companies match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
