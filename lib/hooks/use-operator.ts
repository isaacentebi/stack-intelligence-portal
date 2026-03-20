import useSWR from "swr";
import { operatorFetcher } from "./swr-config";

// ── Operator Status ──────────────────────────────────────
export function useOperatorStatus() {
  return useSWR<Record<string, any>>("/api/operator/status", operatorFetcher, {
    dedupingInterval: 30_000,
  });
}

// ── Bottlenecks ──────────────────────────────────────────
export function useBottlenecks<T = any>() {
  return useSWR<T>("/api/operator/bottlenecks/active", operatorFetcher, {
    dedupingInterval: 30_000,
  });
}

export function useBottleneckDecisions(enabled: boolean) {
  return useSWR(
    enabled ? "/api/operator/bottlenecks/decisions" : null,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

// ── Review Queue ─────────────────────────────────────────
export function useReviewQueue() {
  return useSWR("/api/operator/reviews/queue", operatorFetcher, {
    dedupingInterval: 10_000,
  });
}

export function useReviewDecisions(enabled: boolean) {
  return useSWR(
    enabled ? "/api/operator/reviews/decisions?limit=100&include_values=true" : null,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

export function useAcceptedChanges(params: string, enabled: boolean) {
  return useSWR(
    enabled ? `/api/operator/analysis/accepted-changes?${params}` : null,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

// ── Activity ─────────────────────────────────────────────
export function useCompanyActivity(lookbackHours: number) {
  return useSWR(
    `/api/operator/analysis/company-activity?lookback_hours=${lookbackHours}&limit=100`,
    operatorFetcher,
    { dedupingInterval: 30_000 },
  );
}

export function useCompanyActivityWider(enabled: boolean) {
  return useSWR(
    enabled ? "/api/operator/analysis/company-activity?lookback_hours=24&limit=200" : null,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

export function useAnalysisAgents() {
  return useSWR("/api/operator/analysis/agents", operatorFetcher, {
    dedupingInterval: 300_000,
  });
}

export function useTriggerLedger(source: string, enabled: boolean) {
  const qs = source === "all" ? "" : `&source=${source}`;
  return useSWR(
    enabled ? `/api/operator/analysis/company-trigger-ledger?limit=50${qs}` : null,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

// ── Company Profile ──────────────────────────────────────
export function useCompanyProfile(ticker: string) {
  return useSWR(
    `/api/companies/${encodeURIComponent(ticker)}/profile`,
    operatorFetcher,
    { dedupingInterval: 60_000 },
  );
}

export function useCompanyFinancials(ticker: string, statement: string, periodType: string, enabled: boolean) {
  return useSWR(
    enabled
      ? `/api/companies/${encodeURIComponent(ticker)}/financials?statement=${statement}&period_type=${periodType}`
      : null,
    operatorFetcher,
    { dedupingInterval: 300_000 },
  );
}

export function useCompanyTranscripts(ticker: string, enabled: boolean) {
  return useSWR(
    enabled ? `/api/companies/${encodeURIComponent(ticker)}/transcripts` : null,
    operatorFetcher,
    { dedupingInterval: 300_000 },
  );
}

export function useCompanyEnrichment(ticker: string, enabled: boolean) {
  return useSWR(
    enabled ? `/api/companies/${encodeURIComponent(ticker)}/enrichment` : null,
    operatorFetcher,
    { dedupingInterval: 300_000 },
  );
}

export function useTranscriptContent(ticker: string, period: string | null) {
  return useSWR(
    period
      ? `/api/companies/${encodeURIComponent(ticker)}/transcripts/${encodeURIComponent(period)}`
      : null,
    operatorFetcher,
    { dedupingInterval: 300_000 },
  );
}

// ── Stock Chart ──────────────────────────────────────────
export function useStockCandles(ticker: string, range: string) {
  return useSWR(
    `/api/companies/${encodeURIComponent(ticker)}/chart?range=${range}`,
    async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      const raw = (data.candles ?? []) as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
      return [...raw].sort((a, b) => a.date.localeCompare(b.date));
    },
    {
      dedupingInterval: 30_000,
      refreshInterval: 60_000,
      isPaused: () => typeof document !== "undefined" && document.visibilityState !== "visible",
    },
  );
}
