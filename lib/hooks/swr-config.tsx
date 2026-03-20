"use client";

import { SWRConfig } from "swr";

export const operatorFetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export function OperatorSWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: operatorFetcher,
        dedupingInterval: 10_000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        errorRetryCount: 2,
        shouldRetryOnError: true,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
