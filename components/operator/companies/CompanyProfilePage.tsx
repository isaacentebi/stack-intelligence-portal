"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  FileText,
  Layers,
  DollarSign,
  Users,
  Target,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCompanyProfile,
  useCompanyFinancials,
  useCompanyTranscripts,
  useCompanyEnrichment,
  useTranscriptContent,
} from "@/lib/hooks/use-operator";

const StockChart = dynamic(
  () => import("@/components/operator/companies/StockChart").then((m) => m.StockChart),
  { ssr: false, loading: () => <div style={{ height: 320, background: "#fafafa" }} /> },
);

/* ── Types ──────────────────────────────────────────────── */

type CompanyProfile = {
  ticker: string;
  identity: Record<string, any>;
  market: Record<string, any>;
  metrics: Record<string, any>;
  valuation: Record<string, any>;
  ratings: Record<string, any>;
  expectations: Record<string, any>;
  ownership: Record<string, any>;
  segments: Record<string, any>;
  earnings: Record<string, any>;
  dividends: Record<string, any>;
  calendarized_financials: Record<string, any>;
  nodes: Array<{
    layer_id: number;
    layer_name: string;
    node_id: string;
    node_title: string;
    role?: string;
    relevance?: string;
  }>;
  registry: Record<string, any>;
};

type FinancialPeriod = Record<string, any>;

type TranscriptEntry = { period: string; date: string; available: boolean };

type Tab = "overview" | "intelligence" | "financials" | "earnings" | "ownership" | "transcripts" | "world-model";

/* ── Currency Context ───────────────────────────────────── */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩",
  TWD: "NT$", HKD: "HK$", CAD: "C$", AUD: "A$", CHF: "CHF ",
  SEK: "kr", NOK: "kr", DKK: "kr", SGD: "S$", INR: "₹",
  BRL: "R$", MXN: "MX$", ZAR: "R", IDR: "Rp", MYR: "RM",
  THB: "฿", PHP: "₱", ILS: "₪", SAR: "﷼", KWD: "KD",
};

// Module-level currency state — set once per profile load
let _ccy = "USD";
let _sym = "$";

function setCurrency(code: string) {
  _ccy = code || "USD";
  _sym = CURRENCY_SYMBOLS[_ccy] ?? `${_ccy} `;
}

/* ── Helpers ────────────────────────────────────────────── */

function fmt(v: any, style: "currency" | "pct" | "number" | "compact" = "compact"): string {
  if (v == null || v === "" || (typeof v === "number" && isNaN(v))) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || isNaN(n)) return String(v);
  if (style === "pct") return `${(n * (Math.abs(n) < 1 ? 100 : 1)).toFixed(1)}%`;
  if (style === "currency") {
    // For large-unit currencies (KRW, JPY), no decimals
    const noDecimals = ["KRW", "JPY", "IDR", "VND"].includes(_ccy);
    return `${_sym}${noDecimals ? Math.round(n).toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (style === "compact") {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    // For KRW/JPY where base units are huge, use local trillion/billion thresholds
    if (abs >= 1e12) return `${sign}${_sym}${(Math.abs(n) / 1e12).toFixed(1)}T`;
    if (abs >= 1e9) return `${sign}${_sym}${(Math.abs(n) / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${_sym}${(Math.abs(n) / 1e6).toFixed(0)}M`;
    if (abs >= 1e3) return `${sign}${_sym}${(Math.abs(n) / 1e3).toFixed(0)}K`;
    return `${_sym}${n.toLocaleString()}`;
  }
  return n.toLocaleString();
}

function delta(v: any): React.ReactNode {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || isNaN(n)) return null;
  const positive = n >= 0;
  return (
    <span style={{
      fontFamily: "var(--font-data)",
      fontSize: 12,
      color: positive ? "var(--positive)" : "var(--negative)",
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
    }}>
      {positive ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
      {positive ? "+" : ""}{(n * (Math.abs(n) < 1 ? 100 : 1)).toFixed(1)}%
    </span>
  );
}

/* ── Stat Card ──────────────────────────────────────────── */

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="co-stat">
      <div className="co-stat-label">{label}</div>
      <div className="co-stat-value">{value}</div>
      {sub && <div className="co-stat-sub">{sub}</div>}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export function CompanyProfilePage({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [aboutOpen, setAboutOpen] = useState(false);

  // Financials UI state
  const [finStatement, setFinStatement] = useState<"income_statement" | "balance_sheet" | "cash_flow">("income_statement");
  const [finPeriodType, setFinPeriodType] = useState<"quarterly" | "annual">("quarterly");
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);

  // Chart-derived price and change % (synced from StockChart)
  const [chartPrice, setChartPrice] = useState<number | null>(null);
  const [chartChangePct, setChartChangePct] = useState<number | null>(null);
  const handleChartDataChange = useCallback((lastPrice: number | null, changePct: number | null) => {
    setChartPrice(lastPrice);
    setChartChangePct(changePct);
  }, []);

  // SWR data fetching
  const { data: profile, error: profileError, isLoading: loading } = useCompanyProfile(ticker);
  const error = profileError ? (profileError instanceof Error ? profileError.message : "Unknown error") : null;

  const { data: financialsData, isLoading: finLoading } = useCompanyFinancials(ticker, finStatement, finPeriodType, tab === "financials");
  const financials = financialsData?.periods ?? [];

  const { data: transcriptsData } = useCompanyTranscripts(ticker, tab === "transcripts");
  const transcripts: TranscriptEntry[] | null = transcriptsData ? (transcriptsData.transcripts ?? []) : null;

  const { data: enrichment, isLoading: enrichmentLoading } = useCompanyEnrichment(ticker, tab === "intelligence");

  const { data: transcriptContentData } = useTranscriptContent(ticker, selectedTranscript);
  const transcriptContent = transcriptContentData?.content ?? (transcriptContentData ? JSON.stringify(transcriptContentData, null, 2) : null);

  if (loading) return <div className="op-loading" style={{ minHeight: 400 }}><span className="op-spinner" />Loading profile…</div>;
  if (error) return <div className="op-error" style={{ margin: 32 }}>{error}</div>;
  if (!profile) return null;

  const p = profile;
  const id = p.identity ?? {};
  const mkt = p.market ?? {};
  const met = p.metrics ?? {};
  const val = p.valuation ?? {};
  const rat = p.ratings ?? {};
  const exp = p.expectations ?? {};
  const own = p.ownership ?? {};
  const seg = p.segments ?? {};
  const ear = p.earnings ?? {};
  const reg = p.registry ?? {};

  // Set currency for formatting
  setCurrency(id.currency ?? "USD");

  // Check data availability for tabs
  const hasEarnings = Array.isArray(ear.history) ? ear.history.length > 0 : false;
  const hasOwnership = (own.institutional?.top_holders ?? []).length > 0;
  const hasTranscripts = true; // lazy-loaded, always show
  const hasNodes = (p.nodes ?? []).length > 0;

  const TABS: { key: Tab; label: string; icon: any; hidden?: boolean }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "intelligence", label: "Intelligence", icon: Brain },
    { key: "financials", label: "Financials", icon: DollarSign },
    { key: "earnings", label: "Earnings", icon: Target, hidden: !hasEarnings && Object.keys(exp.annual ?? {}).length === 0 },
    { key: "ownership", label: "Ownership", icon: Users, hidden: !hasOwnership },
    { key: "transcripts", label: "Transcripts", icon: FileText },
    { key: "world-model", label: "World Model", icon: Layers, hidden: !hasNodes },
  ];

  // Use chart-derived price/change when available, fallback to static profile data
  const displayPrice = chartPrice ?? mkt.price;
  const displayChangePct = chartChangePct ?? mkt.quote?.change_pct;
  const changeUp = displayChangePct != null && displayChangePct >= 0;

  return (
    <div className="co-profile">
      {/* Ticker bar */}
      <div className="co-bar">
        <div className="co-bar-left">
          <button type="button" className="co-bar-back" onClick={() => router.push("/operator/companies")}>
            <ArrowLeft style={{ width: 12, height: 12 }} /> List
          </button>
          <span className="co-bar-sep" />
          <span className="co-bar-name">{id.name ?? ticker}</span>
          <span className="co-bar-ticker">{ticker}</span>
        </div>
        <div className="co-bar-right">
          <span className="co-bar-price">{fmt(displayPrice, "currency")}</span>
          {displayChangePct != null && (
            <span className={`co-bar-delta ${changeUp ? "co-bar-delta--up" : "co-bar-delta--dn"}`}>
              {changeUp ? "+" : ""}{displayChangePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Data strip */}
      <div className="co-strip">
        <span className="co-strip-item"><span className="co-strip-label">Mkt Cap</span>{fmt(mkt.market_cap, "compact")}</span>
        <span className="co-strip-item"><span className="co-strip-label">EV</span>{fmt(mkt.enterprise_value, "compact")}</span>
        <span className="co-strip-item"><span className="co-strip-label">Sector</span>{id.sector}</span>
        <span className="co-strip-item"><span className="co-strip-label">Industry</span>{id.industry}</span>
        <span className="co-strip-item"><span className="co-strip-label">Exchange</span>{id.exchange}</span>
        <span className="co-strip-item"><span className="co-strip-label">Country</span>{id.country}</span>
        {id.employees != null && <span className="co-strip-item"><span className="co-strip-label">Employees</span>{Number(id.employees).toLocaleString()}</span>}
        {id.currency && id.currency !== "USD" && <span className="co-strip-item"><span className="co-strip-label">Currency</span>{id.currency}</span>}
      </div>

      {/* About dropdown */}
      {(id.description || reg.description) && (
        <div className="co-about-toggle">
          <button type="button" onClick={() => setAboutOpen(!aboutOpen)} className="co-about-btn">
            About {aboutOpen ? "−" : "+"}
          </button>
          {aboutOpen && (
            <p className="co-about-text">{id.description ?? reg.description}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <nav className="co-tabs">
        {TABS.filter((t) => !t.hidden).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`co-tab${tab === key ? " co-tab--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab met={met} val={val} rat={rat} exp={exp} seg={seg} id={id} reg={reg} mkt={mkt} ticker={ticker} onChartDataChange={handleChartDataChange} />}
      <div className={tab === "overview" ? "" : "co-tab-content"}>
        {tab === "overview" ? null : null}
        {tab === "intelligence" && (
          enrichmentLoading
            ? <div className="op-loading"><span className="op-spinner" />Loading intelligence…</div>
            : <IntelligenceTab enrichment={enrichment} profileNodes={p.nodes} />
        )}
        {tab === "financials" && (
          <FinancialsTab
            financials={financials}
            loading={finLoading}
            statement={finStatement}
            periodType={finPeriodType}
            onStatementChange={setFinStatement}
            onPeriodTypeChange={setFinPeriodType}
          />
        )}
        {tab === "earnings" && <EarningsTab ear={ear} exp={exp} multiples={(val.multiples ?? {})} />}
        {tab === "ownership" && <OwnershipTab own={own} />}
        {tab === "transcripts" && (
          <TranscriptsTab
            transcripts={transcripts}
            content={transcriptContent}
            selected={selectedTranscript}
            onSelect={setSelectedTranscript}
          />
        )}
        {tab === "world-model" && <WorldModelTab nodes={p.nodes} ticker={ticker} />}
      </div>
    </div>
  );
}

/* ── Tab: Overview ──────────────────────────────────────── */

function pctClass(v: number | null | undefined): string {
  if (v == null) return "";
  return v >= 0 ? "co-dt-value--positive" : "co-dt-value--negative";
}

function fmtPct(v: any): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function Row({ label, value, indent, muted }: { label: string; value: string; indent?: boolean; muted?: boolean }) {
  return (
    <tr>
      <td className={`co-dt-label${indent ? " co-dt-label--indent" : ""}`}>{label}</td>
      <td className={`co-dt-value${muted ? " co-dt-value--muted" : ""}`}>{value}</td>
    </tr>
  );
}

/** Growth row: signed, colored, bold (+15.1% green, -3.2% red, 0.0% neutral) */
function GrowthRow({ label, value, indent = true }: { label: string; value: number | null | undefined; indent?: boolean }) {
  const cls = value == null ? "" : value === 0 ? "co-dt-value--neutral" : pctClass(value);
  return (
    <tr>
      <td className={`co-dt-label${indent ? " co-dt-label--indent" : ""}`}>{label}</td>
      <td className={`co-dt-value ${cls}`}>{value != null ? fmtPct(value) : "—"}</td>
    </tr>
  );
}

/** Margin row: plain ratio, no sign, no color (59.7%) */
function MarginRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <tr>
      <td className="co-dt-label co-dt-label--indent">{label}</td>
      <td className="co-dt-value co-dt-value--muted">{value != null ? `${value.toFixed(1)}%` : "—"}</td>
    </tr>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="co-panel">
      <div className="co-panel-title">{title}</div>
      <table className="co-data-table"><tbody>{children}</tbody></table>
    </div>
  );
}

function OverviewTab({ met, val, rat, exp, seg, id, reg, mkt, ticker, onChartDataChange }: Record<string, any>) {
  const ttm = met.trailing_12_months ?? {};
  const margins = met.margins ?? {};
  const returns = met.returns ?? {};
  const growth = met.growth ?? {};
  const leverage = met.leverage ?? {};
  const bs = met.balance_sheet_summary ?? {};
  const multiples = val.multiples ?? {};
  const dcf = val.dcf ?? {};
  const scores = val.scores ?? {};
  const vsHistory = val.vs_history ?? {};
  const priceTargets = exp.price_targets ?? {};

  return (
    <>
    <StockChart ticker={ticker} currency={id.currency ?? "USD"} onDataChange={onChartDataChange} />
    <div className="co-tab-content">
    <div className="co-panel-grid">
      <Panel title="Key Stats (TTM)">
        <Row label="Revenue" value={fmt(ttm.revenue)} />
        <GrowthRow label="% Growth" value={growth.revenue_yoy_pct} />
        <Row label="Gross Profit" value={fmt(ttm.gross_profit)} />
        <MarginRow label="% Margin" value={margins.gross_pct} />
        <Row label="EBITDA" value={fmt(ttm.ebitda)} />
        <MarginRow label="% Margin" value={margins.operating_pct} />
        <Row label="Net Income" value={fmt(ttm.net_income)} />
        <MarginRow label="% Margin" value={margins.net_pct} />
        <Row label="EPS Diluted" value={fmt(ttm.eps, "currency")} />
        <GrowthRow label="% Growth" value={growth.eps_yoy_pct} />
        <Row label="Free Cash Flow" value={fmt(ttm.fcf)} />
        <MarginRow label="% Margin" value={margins.fcf_pct} />
      </Panel>

      <Panel title="Valuation">
        <Row label="P/E (TTM)" value={multiples.pe_ttm?.toFixed(1) ?? "—"} />
        {multiples.pe_forward_fy2027 != null && <Row label="Fwd P/E FY27" value={multiples.pe_forward_fy2027.toFixed(1)} />}
        {multiples.pe_forward_fy2028 != null && <Row label="Fwd P/E FY28" value={multiples.pe_forward_fy2028.toFixed(1)} />}
        {multiples.pe_forward_fy2029 != null && <Row label="Fwd P/E FY29" value={multiples.pe_forward_fy2029.toFixed(1)} />}
        {multiples.pe_forward_fy2030 != null && <Row label="Fwd P/E FY30" value={multiples.pe_forward_fy2030.toFixed(1)} />}
        <Row label="P/S" value={multiples.ps_ttm?.toFixed(1) ?? "—"} />
        <Row label="P/B" value={multiples.pb?.toFixed(1) ?? "—"} />
        <Row label="EV / EBITDA" value={multiples.ev_ebitda?.toFixed(1) ?? "—"} />
        <Row label="EV / Revenue" value={multiples.ev_revenue?.toFixed(1) ?? "—"} />
        <Row label="FCF Yield" value={`${multiples.fcf_yield_pct?.toFixed(2) ?? "—"}%`} />
        <Row label="Div Yield" value={`${multiples.dividend_yield_pct?.toFixed(2) ?? "—"}%`} />
        {dcf.levered && <Row label="DCF Value" value={fmt(dcf.levered.intrinsic_value, "currency")} />}
        {dcf.levered && <GrowthRow label="vs Price" value={dcf.levered.vs_price_pct} />}
        {vsHistory.pe_5y_avg != null && <Row label="P/E 5Y Avg" value={vsHistory.pe_5y_avg.toFixed(1)} muted />}
      </Panel>

      <Panel title="Returns & Leverage">
        <Row label="ROE" value={`${returns.roe_pct?.toFixed(1) ?? "—"}%`} />
        <Row label="ROA" value={`${returns.roa_pct?.toFixed(1) ?? "—"}%`} />
        <Row label="ROIC" value={`${returns.roic_pct?.toFixed(1) ?? "—"}%`} />
        <Row label="D / E" value={leverage.debt_to_equity?.toFixed(2) ?? "—"} />
        <Row label="D / EBITDA" value={leverage.debt_to_ebitda?.toFixed(2) ?? "—"} />
        <Row label="Interest Cov." value={leverage.interest_coverage?.toFixed(1) ?? "—"} />
        <Row label="Current" value={leverage.current_ratio?.toFixed(2) ?? "—"} />
        <Row label="Quick" value={leverage.quick_ratio?.toFixed(2) ?? "—"} />
      </Panel>

      <Panel title="Balance Sheet">
        <Row label="Total Assets" value={fmt(bs.total_assets)} />
        <Row label="Total Liabilities" value={fmt(bs.total_liabilities)} />
        <Row label="Equity" value={fmt(bs.total_equity)} />
        <Row label="Cash" value={fmt(bs.cash)} />
        <Row label="Total Debt" value={fmt(bs.total_debt)} />
        <Row label="Net Cash" value={fmt(bs.net_cash)} />
      </Panel>

      <Panel title="Growth">
        <GrowthRow label="Revenue YoY" value={growth.revenue_yoy_pct} indent={false} />
        <GrowthRow label="Rev 3Y CAGR" value={growth.revenue_3y_cagr_pct} indent={false} />
        <GrowthRow label="EPS YoY" value={growth.eps_yoy_pct} indent={false} />
        <GrowthRow label="EPS 3Y CAGR" value={growth.eps_3y_cagr_pct} indent={false} />
        <GrowthRow label="FCF YoY" value={growth.fcf_yoy_pct} indent={false} />
      </Panel>

      <Panel title="Scores">
        {scores.rating && <Row label="Rating" value={String(scores.rating)} />}
        {scores.overall_score != null && <Row label="Score" value={`${scores.overall_score}/5`} />}
        {scores.altman_z != null && <Row label="Altman Z" value={scores.altman_z.toFixed(1)} />}
        {scores.piotroski != null && <Row label="Piotroski" value={`${scores.piotroski}/9`} />}
      </Panel>

      {mkt.returns && (
        <Panel title="Price Returns">
          {mkt.returns["1d_pct"] != null && <GrowthRow label="1 Day" value={mkt.returns["1d_pct"]} indent={false} />}
          {mkt.returns["1w_pct"] != null && <GrowthRow label="1 Week" value={mkt.returns["1w_pct"]} indent={false} />}
          {mkt.returns["1m_pct"] != null && <GrowthRow label="1 Month" value={mkt.returns["1m_pct"]} indent={false} />}
          {mkt.returns["3m_pct"] != null && <GrowthRow label="3 Month" value={mkt.returns["3m_pct"]} indent={false} />}
          {mkt.returns.ytd_pct != null && <GrowthRow label="YTD" value={mkt.returns.ytd_pct} indent={false} />}
          {mkt.returns["1y_pct"] != null && <GrowthRow label="1 Year" value={mkt.returns["1y_pct"]} indent={false} />}
        </Panel>
      )}

      {priceTargets && (priceTargets.last_quarter_avg != null || priceTargets.last_year_avg != null) && (
        <Panel title="Analyst Targets">
          {priceTargets.last_quarter_avg != null && <Row label="Avg (Quarter)" value={fmt(priceTargets.last_quarter_avg, "currency")} />}
          {priceTargets.last_month_avg != null && <Row label="Avg (Month)" value={fmt(priceTargets.last_month_avg, "currency")} />}
          {priceTargets.last_year_avg != null && <Row label="Avg (Year)" value={fmt(priceTargets.last_year_avg, "currency")} />}
          {priceTargets.upside_pct != null && <GrowthRow label="Upside" value={priceTargets.upside_pct} indent={false} />}
          {(priceTargets.analysts_count ?? priceTargets.last_quarter_count) != null && <Row label="Analysts" value={String(priceTargets.analysts_count ?? priceTargets.last_quarter_count)} />}
        </Panel>
      )}

    </div>
    </div>
    </>
  );
}

/* ── Tab: Financials ────────────────────────────────────── */

// noRedNeg: items that are expected to be negative (don't color red)
type FinRow = {
  key: string;
  label: string;
  bold?: boolean;
  indent?: boolean;
  pct?: boolean;
  perShare?: boolean;
  separator?: boolean;
  noRedNeg?: boolean;  // don't color negative values red (expected negatives)
};

const INCOME_ROWS: FinRow[] = [
  { key: "revenue", label: "Revenue", bold: true },
  { key: "_revenue_growth", label: "% Growth", pct: true, indent: true },
  { key: "cost_of_revenue", label: "Cost of Revenue", indent: true, noRedNeg: true },
  { key: "gross_profit", label: "Gross Profit", bold: true, separator: true },
  { key: "_gross_margin", label: "% Margin", pct: true, indent: true },
  { key: "research_and_development_expenses", label: "R&D Expenses", indent: true, noRedNeg: true },
  { key: "selling_general_and_administrative_expenses", label: "SG&A Expenses", indent: true, noRedNeg: true },
  { key: "operating_expenses", label: "Total Operating Expenses", bold: true, noRedNeg: true },
  { key: "operating_income", label: "Operating Income", bold: true, separator: true },
  { key: "_operating_margin", label: "% Margin", pct: true, indent: true },
  { key: "interest_expense", label: "Interest Expense", indent: true, noRedNeg: true },
  { key: "income_before_tax", label: "Income Before Tax", bold: true, separator: true },
  { key: "income_tax_expense", label: "Income Tax Expense", indent: true, noRedNeg: true },
  { key: "net_income", label: "Net Income", bold: true, separator: true },
  { key: "_net_margin", label: "% Margin", pct: true, indent: true },
  { key: "ebitda", label: "EBITDA", bold: true, separator: true },
  { key: "_ebitda_margin", label: "% Margin", pct: true, indent: true },
  { key: "eps_diluted", label: "EPS (Diluted)", bold: true, perShare: true, separator: true },
  { key: "_eps_growth", label: "% Growth", pct: true, indent: true },
  { key: "weighted_average_shares_diluted", label: "Shares Outstanding", indent: true, noRedNeg: true },
];

const BALANCE_ROWS: FinRow[] = [
  // Current Assets
  { key: "cash_and_cash_equivalents", label: "Cash & Equivalents", indent: true },
  { key: "short_term_investments", label: "Short-Term Investments", indent: true },
  { key: "net_receivables", label: "Net Receivables", indent: true },
  { key: "inventory", label: "Inventory", indent: true },
  { key: "total_current_assets", label: "Total Current Assets", bold: true },
  // Non-Current Assets
  { key: "property_plant_equipment_net", label: "PP&E (Net)", indent: true },
  { key: "goodwill", label: "Goodwill", indent: true },
  { key: "intangible_assets", label: "Intangible Assets", indent: true },
  { key: "long_term_investments", label: "Long-Term Investments", indent: true },
  { key: "other_non_current_assets", label: "Other Non-Current Assets", indent: true },
  { key: "total_assets", label: "Total Assets", bold: true, separator: true },
  // Current Liabilities
  { key: "account_payables", label: "Accounts Payable", indent: true },
  { key: "short_term_debt", label: "Short-Term Debt", indent: true },
  { key: "deferred_revenue", label: "Deferred Revenue", indent: true },
  { key: "total_current_liabilities", label: "Total Current Liabilities", bold: true },
  // Non-Current Liabilities
  { key: "long_term_debt", label: "Long-Term Debt", indent: true },
  { key: "other_non_current_liabilities", label: "Other Non-Current Liabilities", indent: true },
  { key: "total_liabilities", label: "Total Liabilities", bold: true, separator: true },
  // Equity
  { key: "common_stock", label: "Common Stock", indent: true },
  { key: "retained_earnings", label: "Retained Earnings", indent: true },
  { key: "total_stockholders_equity", label: "Total Equity", bold: true, separator: true },
  // Summary
  { key: "total_debt", label: "Total Debt", indent: true },
  { key: "net_debt", label: "Net Debt", indent: true },
];

const CASHFLOW_ROWS: FinRow[] = [
  // Operating Activities
  { key: "net_income", label: "Net Income", indent: true },
  { key: "depreciation_and_amortization", label: "Depreciation & Amortization", indent: true },
  { key: "stock_based_compensation", label: "Stock-Based Compensation", indent: true },
  { key: "change_in_working_capital", label: "Change in Working Capital", indent: true },
  { key: "other_operating_activities", label: "Other Operating Activities", indent: true },
  { key: "operating_cash_flow", label: "Cash from Operations", bold: true, separator: true },
  { key: "_ocf_margin", label: "% of Revenue", pct: true, indent: true },
  // Investing Activities
  { key: "capital_expenditure", label: "Capital Expenditures", indent: true, noRedNeg: true },
  { key: "acquisitions_net", label: "Acquisitions (Net)", indent: true, noRedNeg: true },
  { key: "purchases_of_investments", label: "Purchases of Investments", indent: true, noRedNeg: true },
  { key: "sales_maturities_of_investments", label: "Sales of Investments", indent: true },
  { key: "other_investing_activities", label: "Other Investing Activities", indent: true },
  { key: "net_cash_used_for_investing_activities", label: "Cash from Investing", bold: true, separator: true, noRedNeg: true },
  // Financing Activities
  { key: "debt_repayment", label: "Debt Repayment", indent: true, noRedNeg: true },
  { key: "common_stock_repurchased", label: "Share Buybacks", indent: true, noRedNeg: true },
  { key: "common_stock_issued", label: "Stock Issued", indent: true },
  { key: "dividends_paid", label: "Dividends Paid", indent: true, noRedNeg: true },
  { key: "other_financing_activities", label: "Other Financing Activities", indent: true },
  { key: "net_cash_provided_by_financing_activities", label: "Cash from Financing", bold: true, separator: true, noRedNeg: true },
  // Summary
  { key: "free_cash_flow", label: "Free Cash Flow", bold: true, separator: true },
  { key: "_fcf_margin", label: "% of Revenue", pct: true, indent: true },
];

const STATEMENT_MAP: Record<string, { label: string; rows: FinRow[] }> = {
  income_statement: { label: "Income Statement", rows: INCOME_ROWS },
  balance_sheet: { label: "Balance Sheet", rows: BALANCE_ROWS },
  cash_flow: { label: "Cash Flow", rows: CASHFLOW_ROWS },
};

function fmtFin(v: any, perShare?: boolean): string {
  if (v == null || v === "" || (typeof v === "number" && isNaN(v))) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || isNaN(n)) return "—";
  if (perShare) {
    const noDecimals = ["KRW", "JPY", "IDR", "VND"].includes(_ccy);
    return noDecimals ? Math.round(n).toLocaleString() : n.toFixed(2);
  }
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function computeDerived(
  periods: FinancialPeriod[],
  allPeriods: FinancialPeriod[],
  key: string,
): { values: (number | null)[]; isGrowth: boolean } {
  // Margin rows
  if (key === "_gross_margin") {
    return { values: periods.map((p) => p.revenue && p.gross_profit ? (p.gross_profit / p.revenue) * 100 : null), isGrowth: false };
  }
  if (key === "_operating_margin") {
    return { values: periods.map((p) => p.revenue && p.operating_income ? (p.operating_income / p.revenue) * 100 : null), isGrowth: false };
  }
  if (key === "_net_margin") {
    return { values: periods.map((p) => p.revenue && p.net_income ? (p.net_income / p.revenue) * 100 : null), isGrowth: false };
  }
  if (key === "_ebitda_margin") {
    return { values: periods.map((p) => p.revenue && p.ebitda ? (p.ebitda / p.revenue) * 100 : null), isGrowth: false };
  }
  if (key === "_ocf_margin") {
    return { values: periods.map((p) => p.revenue && p.operating_cash_flow ? (p.operating_cash_flow / p.revenue) * 100 : null), isGrowth: false };
  }
  if (key === "_fcf_margin") {
    return { values: periods.map((p) => p.revenue && p.free_cash_flow ? (p.free_cash_flow / p.revenue) * 100 : null), isGrowth: false };
  }

  // YoY growth rows — find same quarter from prior year
  if (key === "_revenue_growth" || key === "_eps_growth") {
    const dataKey = key === "_revenue_growth" ? "revenue" : "eps_diluted";
    const parseFY = (fy: any): number => {
      if (fy == null) return NaN;
      const s = String(fy).replace(/\D/g, ""); // "FY26" -> "26", "2026" -> "2026"
      return Number(s);
    };

    const values = periods.map((p) => {
      const curVal = p[dataKey];
      if (curVal == null) return null;
      const curFY = parseFY(p.fiscal_year);
      const curQ = p.period;
      if (isNaN(curFY)) return null;
      const match = allPeriods.find((pp) =>
        pp.period === curQ && parseFY(pp.fiscal_year) === curFY - 1,
      );
      if (!match || match[dataKey] == null || match[dataKey] === 0) return null;
      return ((curVal - match[dataKey]) / Math.abs(match[dataKey])) * 100;
    });
    return { values, isGrowth: true };
  }

  return { values: periods.map(() => null), isGrowth: false };
}

function FinancialsTab({
  financials,
  loading,
  statement,
  periodType,
  onStatementChange,
  onPeriodTypeChange,
}: {
  financials: FinancialPeriod[] | null;
  loading: boolean;
  statement: string;
  periodType: string;
  onStatementChange: (v: any) => void;
  onPeriodTypeChange: (v: any) => void;
}) {
  const config = STATEMENT_MAP[statement] ?? STATEMENT_MAP.income_statement;
  // Sort by date descending (newest left). Keep all for growth lookups, display first 10.
  const sorted = [...(financials ?? [])]
    .sort((a, b) => (b.fiscal_date ?? b.calendar_date ?? "").localeCompare(a.fiscal_date ?? a.calendar_date ?? ""));
  const periods = sorted.slice(0, 8);
  const allPeriods = sorted;

  const STATEMENTS = [
    { key: "income_statement", label: "Income Statement" },
    { key: "balance_sheet", label: "Balance Sheet" },
    { key: "cash_flow", label: "Cash Flow" },
  ];

  const PERIODS = [
    { key: "quarterly", label: "Quarterly" },
    { key: "annual", label: "Annual" },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="fin-controls">
        <div className="fin-btn-group">
          {STATEMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`fin-btn${statement === s.key ? " fin-btn--on" : ""}`}
              onClick={() => onStatementChange(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="fin-btn-group">
          {PERIODS.map((pt) => (
            <button
              key={pt.key}
              type="button"
              className={`fin-btn${periodType === pt.key ? " fin-btn--on" : ""}`}
              onClick={() => onPeriodTypeChange(pt.key)}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="op-loading"><span className="op-spinner" />Loading financials…</div>}

      {!loading && periods.length > 0 && (
        <div className="co-fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">{config.label}</th>
                {periods.map((p, i) => (
                  <th key={i} className="fin-th-period">
                    {p.period && p.fiscal_year
                      ? `${p.period} '${String(p.fiscal_year).replace(/\D/g, "").slice(-2)}`
                      : p.calendar_date ?? `P${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.rows.map((row) => {
                const isDerived = row.pct && row.key.startsWith("_");
                const derived = isDerived ? computeDerived(periods, sorted, row.key) : null;

                // Skip rows where ALL periods are null
                if (!isDerived) {
                  const hasAny = periods.some((p) => p[row.key] != null);
                  if (!hasAny) return null;
                }

                const rowClasses = [
                  row.separator && "fin-row--sep",
                  row.bold && "fin-row--bold",
                  isDerived && "fin-row--derived",
                ].filter(Boolean).join(" ");

                return (
                  <tr key={row.key} className={rowClasses}>
                    <td className={`fin-td-label${row.bold ? " fin-td-label--bold" : ""}${row.indent ? " fin-td-label--indent" : ""}`}>
                      {row.label}
                    </td>
                    {periods.map((p, i) => {
                      if (isDerived && derived) {
                        const v = derived.values[i];
                        if (derived.isGrowth) {
                          // Growth: signed, colored
                          const cls = v == null ? "" : v > 0 ? " fin-td-value--up" : v < 0 ? " fin-td-value--dn" : "";
                          return (
                            <td key={i} className={`fin-td-value fin-td-value--derived${cls}`}>
                              {v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"}
                            </td>
                          );
                        }
                        // Margin: plain percentage, muted
                        return (
                          <td key={i} className="fin-td-value fin-td-value--derived">
                            {v != null ? `${v.toFixed(1)}%` : "—"}
                          </td>
                        );
                      }
                      const val = p[row.key];
                      const isNeg = typeof val === "number" && val < 0 && !row.noRedNeg;
                      return (
                        <td key={i} className={`fin-td-value${row.bold ? " fin-td-value--bold" : ""}${isNeg ? " fin-td-value--neg" : ""}`}>
                          {val != null ? fmtFin(val, row.perShare) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && periods.length === 0 && (
        <div className="op-empty">No financial data available for this period type.</div>
      )}
    </div>
  );
}

/* ── Tab: Earnings ──────────────────────────────────────── */

function EarningsTab({ ear, exp, multiples }: { ear: Record<string, any>; exp: Record<string, any>; multiples: Record<string, any> }) {
  const history = Array.isArray(ear) ? ear : (ear.history ?? []);
  const annualEst = exp.annual ?? {};
  const quarterlyEst = exp.quarterly ?? [];
  const annualKeys = Object.keys(annualEst).filter((k) => typeof annualEst[k] === "object");

  if (!Array.isArray(history) || history.length === 0) {
    return <div className="op-empty">No earnings data available.</div>;
  }

  return (
    <div>
      <div className="co-fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th className="fin-th-label">Period</th>
              <th className="fin-th-period">EPS Actual</th>
              <th className="fin-th-period">EPS Est.</th>
              <th className="fin-th-period">EPS Surprise</th>
              <th className="fin-th-period">Revenue Actual</th>
              <th className="fin-th-period">Revenue Est.</th>
              <th className="fin-th-period">Rev. Surprise</th>
              <th className="fin-th-period">Beat</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 16).map((e: any, i: number) => {
              const epsSurp = e.eps_surprise_pct;
              const revSurp = e.revenue_surprise_pct;
              return (
                <tr key={i}>
                  <td className="fin-td-label fin-td-label--bold">{e.period}</td>
                  <td className="fin-td-value fin-td-value--bold">{fmtFin(e.eps_actual, true)}</td>
                  <td className="fin-td-value fin-td-value--derived">{fmtFin(e.eps_estimate, true)}</td>
                  <td className={`fin-td-value${epsSurp > 0 ? " fin-td-value--up" : epsSurp < 0 ? " fin-td-value--dn" : ""}`}>
                    {epsSurp != null ? `${epsSurp >= 0 ? "+" : ""}${epsSurp.toFixed(1)}%` : "—"}
                  </td>
                  <td className="fin-td-value fin-td-value--bold">{fmtFin(e.revenue_actual)}</td>
                  <td className="fin-td-value fin-td-value--derived">{fmtFin(e.revenue_estimate)}</td>
                  <td className={`fin-td-value${revSurp > 0 ? " fin-td-value--up" : revSurp < 0 ? " fin-td-value--dn" : ""}`}>
                    {revSurp != null ? `${revSurp >= 0 ? "+" : ""}${revSurp.toFixed(1)}%` : "—"}
                  </td>
                  <td className="fin-td-value">
                    {e.beat_eps && e.beat_revenue ? <span style={{ color: "#18A055" }}>Beat</span> :
                     e.beat_eps || e.beat_revenue ? <span style={{ color: "#888" }}>Mixed</span> :
                     <span style={{ color: "#D94040" }}>Miss</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Forward Annual Estimates */}
      {annualKeys.length > 0 && (
        <div className="co-fin-table-wrap" style={{ marginTop: 20 }}>
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">Annual Estimates</th>
                {annualKeys.map((fy) => (
                  <th key={fy} className="fin-th-period">{fy.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fin-td-label fin-td-label--bold">Revenue</td>
                {annualKeys.map((fy) => (
                  <td key={fy} className="fin-td-value fin-td-value--bold">{fmtFin(annualEst[fy].revenue)}</td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">% Growth</td>
                {annualKeys.map((fy) => {
                  const g = annualEst[fy].revenue_growth_pct;
                  return (
                    <td key={fy} className={`fin-td-value fin-td-value--derived${g > 0 ? " fin-td-value--up" : g < 0 ? " fin-td-value--dn" : ""}`}>
                      {g != null ? `${g >= 0 ? "+" : ""}${g.toFixed(1)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="fin-td-label fin-td-label--bold">EPS (Avg)</td>
                {annualKeys.map((fy) => (
                  <td key={fy} className="fin-td-value fin-td-value--bold">{fmtFin(annualEst[fy].eps_avg, true)}</td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">EPS Range</td>
                {annualKeys.map((fy) => (
                  <td key={fy} className="fin-td-value fin-td-value--derived">
                    {fmtFin(annualEst[fy].eps_low, true)}–{fmtFin(annualEst[fy].eps_high, true)}
                  </td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">Analysts</td>
                {annualKeys.map((fy) => (
                  <td key={fy} className="fin-td-value fin-td-value--derived">{annualEst[fy].analysts_count ?? "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Forward Quarterly Estimates */}
      {quarterlyEst.length > 0 && (
        <div className="co-fin-table-wrap" style={{ marginTop: 20 }}>
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">Quarterly Estimates</th>
                {quarterlyEst.map((q: any) => (
                  <th key={q.period} className="fin-th-period">{q.period}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fin-td-label fin-td-label--bold">Revenue</td>
                {quarterlyEst.map((q: any) => (
                  <td key={q.period} className="fin-td-value fin-td-value--bold">{fmtFin(q.revenue)}</td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">% YoY Growth</td>
                {quarterlyEst.map((q: any) => {
                  // Find same quarter from earnings history (prior year)
                  const qLabel = q.period?.split(" ")[0]; // "Q1"
                  const priorMatch = history.find((h: any) => {
                    const hQ = h.period?.split(" ")[0];
                    return hQ === qLabel;
                  });
                  const g = priorMatch?.revenue_actual && q.revenue
                    ? ((q.revenue - priorMatch.revenue_actual) / priorMatch.revenue_actual) * 100
                    : null;
                  return (
                    <td key={q.period} className={`fin-td-value fin-td-value--derived${g != null && g > 0 ? " fin-td-value--up" : g != null && g < 0 ? " fin-td-value--dn" : ""}`}>
                      {g != null ? `${g >= 0 ? "+" : ""}${g.toFixed(1)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="fin-td-label fin-td-label--bold">EPS (Avg)</td>
                {quarterlyEst.map((q: any) => (
                  <td key={q.period} className="fin-td-value fin-td-value--bold">{fmtFin(q.eps_avg, true)}</td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">EPS Range</td>
                {quarterlyEst.map((q: any) => (
                  <td key={q.period} className="fin-td-value fin-td-value--derived">
                    {fmtFin(q.eps_low, true)}–{fmtFin(q.eps_high, true)}
                  </td>
                ))}
              </tr>
              <tr className="fin-row--derived">
                <td className="fin-td-label fin-td-label--indent">Analysts</td>
                {quarterlyEst.map((q: any) => (
                  <td key={q.period} className="fin-td-value fin-td-value--derived">{q.analysts_count ?? "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Forward Valuation */}
      {(multiples.pe_forward_fy2027 != null || multiples.pe_forward_fy2028 != null) && (
        <div className="co-fin-table-wrap" style={{ marginTop: 20 }}>
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">Forward Valuation</th>
                <th className="fin-th-period">P/E (TTM)</th>
                {multiples.pe_forward_fy2027 != null && <th className="fin-th-period">Fwd P/E FY27</th>}
                {multiples.pe_forward_fy2028 != null && <th className="fin-th-period">Fwd P/E FY28</th>}
                {multiples.pe_forward_fy2029 != null && <th className="fin-th-period">Fwd P/E FY29</th>}
                {multiples.pe_forward_fy2030 != null && <th className="fin-th-period">Fwd P/E FY30</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fin-td-label fin-td-label--bold">Price / Earnings</td>
                <td className="fin-td-value fin-td-value--bold">{multiples.pe_ttm?.toFixed(1) ?? "—"}</td>
                {multiples.pe_forward_fy2027 != null && <td className="fin-td-value fin-td-value--bold">{multiples.pe_forward_fy2027.toFixed(1)}</td>}
                {multiples.pe_forward_fy2028 != null && <td className="fin-td-value fin-td-value--bold">{multiples.pe_forward_fy2028.toFixed(1)}</td>}
                {multiples.pe_forward_fy2029 != null && <td className="fin-td-value fin-td-value--bold">{multiples.pe_forward_fy2029.toFixed(1)}</td>}
                {multiples.pe_forward_fy2030 != null && <td className="fin-td-value fin-td-value--bold">{multiples.pe_forward_fy2030.toFixed(1)}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Ownership ─────────────────────────────────────── */

function OwnershipTab({ own }: { own: Record<string, any> }) {
  const inst = own.institutional ?? {};
  const insider = own.insider ?? {};
  const holders = inst.top_holders ?? [];

  return (
    <div>
      {/* Summary stats */}
      <div className="co-panel-grid" style={{ marginBottom: 20 }}>
        <div className="co-panel">
          <div className="co-panel-title">Institutional Ownership</div>
          <table className="co-data-table">
            <tbody>
              {inst.ownership_pct != null && <Row label="Ownership" value={`${inst.ownership_pct.toFixed(1)}%`} />}
              {inst.holders_count != null && <Row label="Holders" value={inst.holders_count.toLocaleString()} />}
              {inst.shares_held != null && <Row label="Shares Held" value={fmtFin(inst.shares_held)} />}
              {inst.value_held != null && <Row label="Value Held" value={fmtFin(inst.value_held)} />}
              {inst.quarterly_change != null && <GrowthRow label="Quarterly Change" value={inst.quarterly_change} indent={false} />}
            </tbody>
          </table>
        </div>
        <div className="co-panel">
          <div className="co-panel-title">Insider Activity (3 Months)</div>
          <table className="co-data-table">
            <tbody>
              {insider.buy_transactions_3m != null && <Row label="Buy Transactions" value={String(insider.buy_transactions_3m)} />}
              {insider.sell_transactions_3m != null && <Row label="Sell Transactions" value={String(insider.sell_transactions_3m)} />}
              {insider.net_shares_3m != null && <Row label="Net Shares" value={fmtFin(insider.net_shares_3m)} />}
              {insider.buy_sell_ratio != null && <Row label="Buy/Sell Ratio" value={insider.buy_sell_ratio.toFixed(2)} />}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top holders table */}
      {holders.length > 0 && (
        <div className="co-fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th className="fin-th-label">Top Institutional Holders</th>
                <th className="fin-th-period">% Held</th>
                <th className="fin-th-period">Shares</th>
                <th className="fin-th-period">Value</th>
                <th className="fin-th-period">Change</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h: any, i: number) => {
                const changeShares = h.change_shares;
                const isUp = changeShares != null && changeShares > 0;
                const isDn = changeShares != null && changeShares < 0;
                return (
                  <tr key={i}>
                    <td className="fin-td-label fin-td-label--bold">{h.name}</td>
                    <td className="fin-td-value fin-td-value--bold">{h.pct?.toFixed(2)}%</td>
                    <td className="fin-td-value">{fmtFin(h.shares)}</td>
                    <td className="fin-td-value">{fmtFin(h.value)}</td>
                    <td className={`fin-td-value${isUp ? " fin-td-value--up" : isDn ? " fin-td-value--dn" : ""}`}>
                      {changeShares != null ? `${isUp ? "+" : ""}${fmtFin(changeShares)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {holders.length === 0 && <div className="op-empty">No ownership data available.</div>}
    </div>
  );
}

/* ── Tab: Transcripts ───────────────────────────────────── */

function TranscriptsTab({
  transcripts,
  content,
  selected,
  onSelect,
}: {
  transcripts: TranscriptEntry[] | null;
  content: string | null;
  selected: string | null;
  onSelect: (period: string | null) => void;
}) {
  if (!transcripts) {
    return <div className="op-loading"><span className="op-spinner" />Loading transcripts…</div>;
  }

  if (transcripts.length === 0) {
    return <div className="op-empty">No transcripts available for this company.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, minHeight: 400 }}>
      <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
        <div className="op-card-kicker">Available Transcripts</div>
        {transcripts.map((t) => (
          <button
            key={t.period}
            type="button"
            className={`wm-dep-btn${selected === t.period ? " wm-company-btn--selected" : ""}`}
            onClick={() => onSelect(t.period === selected ? null : t.period)}
          >
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 500 }}>{t.period}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.date}</span>
          </button>
        ))}
      </div>
      <div>
        {!selected && <div className="op-empty">Select a transcript to read.</div>}
        {selected && !content && <div className="op-loading"><span className="op-spinner" />Loading transcript…</div>}
        {selected && content && (
          <div className="co-transcript">
            <div className="co-transcript-header">{selected}</div>
            <pre className="co-transcript-body">{content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tab: World Model ───────────────────────────────────── */

function WorldModelTab({ nodes, ticker }: { nodes: CompanyProfile["nodes"]; ticker: string }) {
  const router = useRouter();

  if (!nodes || nodes.length === 0) {
    return <div className="op-empty">This company does not appear in any world-model nodes.</div>;
  }

  return (
    <div>
      <div className="op-card-kicker" style={{ marginBottom: 12 }}>
        {ticker} appears in {nodes.length} node{nodes.length !== 1 ? "s" : ""}
      </div>
      <div className="op-grid" style={{ gap: 8 }}>
        {nodes.map((n, i) => (
          <button
            key={`${n.node_id}-${i}`}
            type="button"
            className="wm-company-btn"
            onClick={() => router.push(`/operator/world?node=${n.node_id}`)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 500 }}>{n.node_title}</span>
              <span className="op-badge op-badge--info" style={{ fontSize: 10 }}>L{n.layer_id}</span>
            </div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>
              {n.node_id} · {n.layer_name}
            </div>
            {n.role && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{n.role}</div>}
            {n.relevance && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Relevance: {n.relevance}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Tab: Intelligence ──────────────────────────────────── */

function capitalize(s: any): string {
  if (!s || typeof s !== "string") return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysAgo(dateStr: any): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  } catch {
    return String(dateStr);
  }
}

function IntelligenceTab({ enrichment, profileNodes }: { enrichment: Record<string, any> | null; profileNodes?: any[] }) {
  const [openPeriods, setOpenPeriods] = useState<Record<number, boolean>>({ 0: true });

  if (!enrichment || Object.keys(enrichment).length === 0) {
    return <div className="op-empty">No intelligence data available for this company.</div>;
  }

  const judgment = enrichment.judgment ?? null;
  const distilled = enrichment.distilled_transcripts ?? [];
  const newsTriage = enrichment.news_triage ?? null;
  const latestNews = enrichment.latest_news ?? null;

  const REL_COLORS: Record<string, { bg: string; fg: string }> = {
    core: { bg: "#0D7A3E", fg: "#fff" },
    significant: { bg: "#0B5EA8", fg: "#fff" },
    peripheral: { bg: "#e5e5e5", fg: "#555" },
  };

  const fmtPeriod = (p: string) => (p ?? "").replace(/_/g, " ");
  const ACRONYMS: Record<string, string> = { Ip: "IP", Ai: "AI", Gpu: "GPU", Cpu: "CPU", Api: "API", Sdk: "SDK", Hbm: "HBM", Tsmc: "TSMC" };
  const humanizeMoat = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()).replace(/\b\w+/g, (w) => ACRONYMS[w] ?? w);

  const togglePeriod = (idx: number) => setOpenPeriods((prev) => ({ ...prev, [idx]: !prev[idx] }));

  // Latest transcript data for top-level sections
  const latest = distilled[0] ?? {};
  const latestR = latest.result ?? latest;
  const allGrowth: any[] = latestR.growth_areas ?? [];
  const allDeclining: any[] = latestR.declining_or_small_areas ?? [];
  const allQuotes: any[] = latestR.supporting_quotes ?? [];
  const allNodeFacts: string[] = latestR.node_relevant_facts ?? [];
  const allUncertainty: string[] = latestR.uncertainty_notes ?? [];

  // Section header style
  const SH = { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400 as const, margin: 0, color: "#111" };
  // Sub-section label style
  const SSL = { fontSize: 12, fontWeight: 600 as const, color: "#888", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 10 };

  return (
    <div>
      {/* ── Thesis ───────────────────────────────────── */}
      {judgment && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <h2 style={SH}>Thesis</h2>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#bbb" }}>
              {judgment.generated_at && daysAgo(judgment.generated_at)} · {judgment.model}
            </span>
          </div>
          {judgment.overall_summary && (
            <p style={{ fontSize: 16, lineHeight: 1.8, color: "#333", margin: 0, borderLeft: "3px solid #0D7A3E", paddingLeft: 18 }}>
              {judgment.overall_summary}
            </p>
          )}
        </section>
      )}

      {/* ── Node Positions ───────────────────────────── */}
      {judgment && Array.isArray(judgment.nodes) && judgment.nodes.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ ...SH, marginBottom: 16 }}>
            Node Positions <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#aaa", fontWeight: 400 }}>({judgment.nodes.length})</span>
          </h2>
          <div className="co-fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th className="fin-th-label" style={{ minWidth: 50 }}>Node</th>
                  <th className="fin-th-label">Name</th>
                  <th className="fin-th-period" style={{ minWidth: 90 }}>Relevance</th>
                  <th className="fin-th-period" style={{ minWidth: 80 }}>Revenue</th>
                  <th className="fin-th-period" style={{ minWidth: 90 }}>Confidence</th>
                  <th className="fin-th-label" style={{ minWidth: 320 }}>Role & Moats</th>
                </tr>
              </thead>
              <tbody>
                {judgment.nodes.map((n: any, i: number) => {
                  const rel = REL_COLORS[n.relevance] ?? REL_COLORS.peripheral;
                  const profileNode = (profileNodes ?? []).find((pn: any) => pn.node_id === n.node_id);
                  const nodeName = n.node_name ?? profileNode?.node_title ?? "";
                  return (
                    <tr key={i}>
                      <td className="fin-td-label" style={{ fontFamily: "var(--font-data)", fontWeight: 600, color: "#0D7A3E", verticalAlign: "top", fontSize: 14 }}>
                        {n.node_id}
                      </td>
                      <td className="fin-td-label" style={{ verticalAlign: "top", color: "#444", fontSize: 14, fontWeight: 500 }}>
                        {nodeName}
                      </td>
                      <td className="fin-td-value" style={{ verticalAlign: "top" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, background: rel.bg, color: rel.fg }}>{capitalize(n.relevance)}</span>
                      </td>
                      <td className="fin-td-value" style={{ verticalAlign: "top", fontSize: 14 }}>{capitalize(n.revenue_exposure)}</td>
                      <td className="fin-td-value" style={{ verticalAlign: "top", fontSize: 14 }}>{capitalize(n.confidence)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 14, color: "#444", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3", verticalAlign: "top" }}>
                        {n.role}
                        {n.moat_in_node?.length > 0 && (
                          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                            {n.moat_in_node.map((m: string) => (
                              <span key={m} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 2, border: "1px solid #d4e8da", color: "#0D7A3E", background: "#f0f8f3", fontWeight: 500 }}>
                                {humanizeMoat(m)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Growth Vectors ────────────────────────────── */}
      {allGrowth.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 20, background: "#18A055", borderRadius: 1 }} />
            <h2 style={SH}>Growth Vectors</h2>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#bbb", marginLeft: "auto" }}>{fmtPeriod(latest.period)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
            {allGrowth.map((ga: any, gi: number) => {
              const area = typeof ga === "string" ? ga : (ga.area ?? ga.label ?? "");
              const detail = typeof ga === "string" ? "" : (ga.detail ?? "");
              const source = typeof ga === "string" ? "" : (ga.source ?? "");
              const quote = typeof ga === "string" ? "" : (ga.quote ?? "");
              return (
                <div key={gi} style={{ padding: "16px 18px", background: "#fafdfb", border: "1px solid #e2ede6", borderRadius: 4, borderLeft: "3px solid #18A055" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: detail || quote ? 10 : 0 }}>
                    <TrendingUp style={{ width: 15, height: 15, color: "#18A055", flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 500, color: "#111" }}>{area}</span>
                  </div>
                  {detail && <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: "0 0 8px" }}>{detail}</p>}
                  {quote && (
                    <blockquote style={{ margin: "10px 0 0", padding: "10px 14px", background: "#f4f8f5", borderLeft: "2px solid #c5dece", fontSize: 13, color: "#4a6b53", lineHeight: 1.6, fontStyle: "italic", borderRadius: "0 3px 3px 0" }}>
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  )}
                  {source && <div style={{ fontSize: 11, color: "#aaa", marginTop: 8, fontFamily: "var(--font-data)" }}>{fmtPeriod(source)}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Declining / Small Areas ───────────────────── */}
      {allDeclining.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 20, background: "#D9A040", borderRadius: 1 }} />
            <h2 style={SH}>Declining & Small Areas</h2>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#bbb", marginLeft: "auto" }}>{fmtPeriod(latest.period)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
            {allDeclining.map((da: any, di: number) => {
              const area = typeof da === "string" ? da : (da.area ?? da.label ?? "");
              const detail = typeof da === "string" ? "" : (da.detail ?? "");
              const source = typeof da === "string" ? "" : (da.source ?? "");
              const quote = typeof da === "string" ? "" : (da.quote ?? "");
              return (
                <div key={di} style={{ padding: "16px 18px", background: "#fefcf7", border: "1px solid #efe3c8", borderRadius: 4, borderLeft: "3px solid #D9A040" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: detail || quote ? 10 : 0 }}>
                    <TrendingDown style={{ width: 15, height: 15, color: "#D9A040", flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 500, color: "#111" }}>{area}</span>
                  </div>
                  {detail && <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: "0 0 8px" }}>{detail}</p>}
                  {quote && (
                    <blockquote style={{ margin: "10px 0 0", padding: "10px 14px", background: "#fdf8ef", borderLeft: "2px solid #e5d5ad", fontSize: 13, color: "#8c7540", lineHeight: 1.6, fontStyle: "italic", borderRadius: "0 3px 3px 0" }}>
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  )}
                  {source && <div style={{ fontSize: 11, color: "#aaa", marginTop: 8, fontFamily: "var(--font-data)" }}>{fmtPeriod(source)}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Supporting Quotes ─────────────────────────── */}
      {allQuotes.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 20, background: "#0B5EA8", borderRadius: 1 }} />
            <h2 style={SH}>Management Quotes</h2>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {allQuotes.map((sq: any, qi: number) => (
              <div key={qi} style={{ padding: "16px 20px", background: "#f8fafc", border: "1px solid #e5eaf0", borderRadius: 4, borderLeft: "3px solid #0B5EA8" }}>
                <blockquote style={{ margin: 0, fontSize: 16, color: "#333", lineHeight: 1.7, fontStyle: "italic", fontFamily: "var(--font-display)" }}>
                  &ldquo;{sq.quote}&rdquo;
                </blockquote>
                {sq.why_it_matters && (
                  <p style={{ margin: "10px 0 0", fontSize: 14, color: "#555", lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 500, color: "#0B5EA8", marginRight: 6 }}>Significance:</span>
                    {sq.why_it_matters}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Node-Relevant Facts ───────────────────────── */}
      {allNodeFacts.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 3, height: 20, background: "#0D7A3E", borderRadius: 1 }} />
            <h2 style={SH}>Node-Relevant Facts</h2>
          </div>
          <div style={{ padding: "14px 18px", background: "#fafafa", border: "1px solid #eee", borderRadius: 4 }}>
            {allNodeFacts.map((fact: string, fi: number) => (
              <div key={fi} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: fi < allNodeFacts.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "baseline" }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: "#0D7A3E", flexShrink: 0, marginTop: 7 }} />
                <span style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>{fact}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Uncertainty Notes ─────────────────────────── */}
      {allUncertainty.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 3, height: 20, background: "#D9A040", borderRadius: 1 }} />
            <h2 style={SH}>Uncertainty & Caveats</h2>
          </div>
          <div style={{ padding: "14px 18px", background: "#fffcf5", border: "1px solid #f0e4c4", borderRadius: 4 }}>
            {allUncertainty.map((note: string, ni: number) => (
              <div key={ni} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: ni < allUncertainty.length - 1 ? "1px solid #f5eed8" : "none", alignItems: "baseline" }}>
                <span style={{ fontSize: 14, color: "#D9A040", fontWeight: 600, flexShrink: 0 }}>!</span>
                <span style={{ fontSize: 14, color: "#6b5e3a", lineHeight: 1.6 }}>{note}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Earnings Call Distills (collapsible per period) */}
      {distilled.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ ...SH, marginBottom: 16 }}>
            Earnings Call Distills <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#aaa", fontWeight: 400 }}>({distilled.length})</span>
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {distilled.map((t: any, ti: number) => {
              const r = t.result ?? t;
              const blines = r.business_lines ?? [];
              const moats = r.moat_clues ?? [];
              const products = r.product_mentions ?? [];
              const segments = r.segment_clues ?? [];
              const geos = r.geography_clues ?? [];
              const isOpen = !!openPeriods[ti];
              const hasContent = blines.length > 0 || moats.length > 0 || products.length > 0 || segments.length > 0 || geos.length > 0;

              return (
                <div key={ti} style={{ border: "1px solid #e5e5e5", borderRadius: 4, overflow: "hidden", background: isOpen ? "#fff" : "#fafafa" }}>
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => togglePeriod(ti)}
                    style={{
                      all: "unset", cursor: "pointer", display: "flex", alignItems: "center", width: "100%",
                      padding: "14px 18px", boxSizing: "border-box", gap: 12,
                      background: isOpen ? "#fff" : "#fafafa",
                      borderBottom: isOpen ? "1px solid #eee" : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#999", transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", lineHeight: 1 }}>&#9654;</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 16, fontWeight: 600, color: "#111" }}>{fmtPeriod(t.period)}</span>
                    <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
                      {blines.length > 0 && <span style={{ fontSize: 11, color: "#999", background: "#f3f3f3", padding: "2px 6px", borderRadius: 2 }}>{blines.length} lines</span>}
                      {moats.length > 0 && <span style={{ fontSize: 11, color: "#0D7A3E", background: "#f0f8f3", padding: "2px 6px", borderRadius: 2 }}>{moats.length} moats</span>}
                      {products.length > 0 && <span style={{ fontSize: 11, color: "#666", background: "#f3f3f3", padding: "2px 6px", borderRadius: 2 }}>{products.length} products</span>}
                    </div>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-data)", fontSize: 11, color: "#ccc" }}>
                      {t.model && <>{t.model} · </>}{t.generated_at && daysAgo(t.generated_at)}
                    </span>
                  </button>

                  {/* Collapsible body */}
                  {isOpen && hasContent && (
                    <div style={{ padding: "18px 20px" }}>
                      {/* Business lines table */}
                      {blines.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={SSL}>Business Lines</div>
                          <div className="co-fin-table-wrap">
                            <table className="fin-table">
                              <thead>
                                <tr>
                                  <th className="fin-th-label" style={{ width: 220 }}>Segment</th>
                                  <th className="fin-th-label">Detail</th>
                                </tr>
                              </thead>
                              <tbody>
                                {blines.map((bl: any, bi: number) => (
                                  <tr key={bi}>
                                    <td className="fin-td-label" style={{ fontWeight: 500, fontSize: 14, color: "#222", verticalAlign: "top" }}>{bl.label}</td>
                                    <td style={{ padding: "10px 14px", fontSize: 14, color: "#555", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3" }}>{bl.detail}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Moats table */}
                      {moats.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={SSL}>Competitive Moats</div>
                          <div className="co-fin-table-wrap">
                            <table className="fin-table">
                              <thead>
                                <tr>
                                  <th className="fin-th-label" style={{ width: 220 }}>Type</th>
                                  <th className="fin-th-label">Evidence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {moats.map((mc: any, mi: number) => (
                                  <tr key={mi}>
                                    <td className="fin-td-label" style={{ fontWeight: 600, fontSize: 14, color: "#0D7A3E", verticalAlign: "top" }}>
                                      {humanizeMoat(mc.type ?? "")}
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: 14, color: "#555", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3" }}>{mc.detail}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Products table */}
                      {products.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={SSL}>Products & Platforms</div>
                          <div className="co-fin-table-wrap">
                            <table className="fin-table">
                              <thead>
                                <tr>
                                  <th className="fin-th-label" style={{ width: 220 }}>Product</th>
                                  <th className="fin-th-label">Detail</th>
                                </tr>
                              </thead>
                              <tbody>
                                {products.map((pm: any, pi: number) => (
                                  <tr key={pi}>
                                    <td className="fin-td-label" style={{ fontWeight: 500, fontSize: 14, color: "#222", verticalAlign: "top" }}>{pm.name}</td>
                                    <td style={{ padding: "10px 14px", fontSize: 14, color: "#555", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3" }}>{pm.detail}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Segments table */}
                      {segments.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={SSL}>Segment Signals</div>
                          <div className="co-fin-table-wrap">
                            <table className="fin-table">
                              <thead>
                                <tr>
                                  <th className="fin-th-label" style={{ width: 220 }}>Signal</th>
                                  <th className="fin-th-label">Detail</th>
                                </tr>
                              </thead>
                              <tbody>
                                {segments.map((sc: any, si: number) => (
                                  <tr key={si}>
                                    <td className="fin-td-label" style={{ fontWeight: 600, fontSize: 14, color: "#0B5EA8", verticalAlign: "top" }}>{sc.signal}</td>
                                    <td style={{ padding: "10px 14px", fontSize: 14, color: "#555", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3" }}>{sc.detail}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Geography table */}
                      {geos.length > 0 && (
                        <div>
                          <div style={SSL}>Geography</div>
                          <div className="co-fin-table-wrap">
                            <table className="fin-table">
                              <thead>
                                <tr>
                                  <th className="fin-th-label" style={{ width: 220 }}>Region</th>
                                  <th className="fin-th-label">Detail</th>
                                </tr>
                              </thead>
                              <tbody>
                                {geos.map((gc: any, gci: number) => (
                                  <tr key={gci}>
                                    <td className="fin-td-label" style={{ fontWeight: 500, fontSize: 14, color: "#222", verticalAlign: "top" }}>{gc.region}</td>
                                    <td style={{ padding: "10px 14px", fontSize: 14, color: "#555", lineHeight: 1.7, borderBottom: "1px solid #f3f3f3" }}>{gc.detail}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── News Wire ─────────────────────────────────── */}
      {(newsTriage || (latestNews?.press_releases?.length > 0)) && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <h2 style={SH}>News</h2>
            {newsTriage && (
              <div style={{ display: "flex", gap: 8 }}>
                {newsTriage.rerun_company && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 2, background: "#fef3cd", color: "#8c5b00" }}>Flagged for Re-evaluation</span>}
                {newsTriage.needs_bottleneck_review && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 2, background: "#fde8e8", color: "#991b1b" }}>Bottleneck Review</span>}
                {!newsTriage.rerun_company && !newsTriage.needs_bottleneck_review && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 2, background: "#e6f4ea", color: "#065c2d" }}>No Action Needed</span>}
              </div>
            )}
          </div>

          {newsTriage?.summary && (
            <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, margin: "0 0 18px", paddingBottom: 18, borderBottom: "1px solid #f0f0f0" }}>
              {newsTriage.summary}
            </p>
          )}

          {latestNews?.press_releases?.length > 0 && (
            <div>
              {latestNews.press_releases.slice(0, 10).map((pr: any, pi: number) => (
                <div key={pi} style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "9px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#bbb", whiteSpace: "nowrap", minWidth: 75 }}>
                    {pr.publishedDate?.slice(5, 10) ?? pr.date?.slice(5, 10) ?? ""}
                  </span>
                  <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5 }}>{pr.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
