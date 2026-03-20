"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, AreaSeries, HistogramSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useStockCandles } from "@/lib/hooks/use-operator";

type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Range = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

const RANGES: Range[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"];

function toChartTime(date: string) {
  const isIntraday = date.includes(" ") || (date.includes("T") && date.includes(":"));
  if (isIntraday) {
    return Math.floor(new Date(date).getTime() / 1000);
  }
  return date.split(" ")[0].split("T")[0];
}

const CCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩",
  TWD: "NT$", HKD: "HK$", CAD: "C$", AUD: "A$", CHF: "CHF",
  INR: "₹", BRL: "R$", IDR: "Rp", SEK: "kr",
};

const NO_DECIMAL_CCY = new Set(["KRW", "JPY", "IDR", "VND", "TWD"]);

function formatPrice(price: number, ccy: string): string {
  const sym = CCY_SYMBOLS[ccy] ?? `${ccy} `;
  if (NO_DECIMAL_CCY.has(ccy)) {
    return `${sym}${Math.round(price).toLocaleString()}`;
  }
  return `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StockChart({ ticker, currency = "USD", onDataChange }: { ticker: string; currency?: string; onDataChange?: (lastPrice: number | null, changePct: number | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [range, setRange] = useState<Range>("1Y");
  const [changePct, setChangePct] = useState<number | null>(null);
  const [empty, setEmpty] = useState(false);

  const { data: candles, isLoading: swrLoading } = useStockCandles(ticker, range);

  // Create chart + initial load
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#fff" },
        textColor: "#999",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      rightPriceScale: {
        borderColor: "#e5e5e5",
        scaleMargins: { top: 0.08, bottom: 0.18 },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, currency),
      },
      timeScale: {
        borderColor: "#e5e5e5",
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#ddd", width: 1, style: 3, labelBackgroundColor: "#555" },
        horzLine: { color: "#ddd", width: 1, style: 3, labelBackgroundColor: "#555" },
      },
      handleScroll: true,
      handleScale: true,
    });

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#18A055",
      topColor: "rgba(24,160,85,0.12)",
      bottomColor: "rgba(24,160,85,0.01)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#18A055",
      crosshairMarkerBorderColor: "#fff",
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    vol.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    areaRef.current = area;
    volRef.current = vol;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      areaRef.current = null;
      volRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply SWR candle data to chart whenever it changes
  useEffect(() => {
    const area = areaRef.current;
    const vol = volRef.current;
    const chart = chartRef.current;
    if (!area || !vol || !chart || !candles) return;

    if (candles.length === 0) {
      area.setData([]);
      vol.setData([]);
      setChangePct(null);
      setEmpty(true);
      return;
    }

    setEmpty(false);
    applyData(candles, area, vol, chart, setChangePct, setEmpty, onDataChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  const isUp = changePct != null && changePct >= 0;

  return (
    <div className="sc">
      <div className="sc-header">
        <div className="sc-ranges">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`sc-range${range === r ? " sc-range--on" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {empty && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#8B949E" }}>No data for {range}</span>}
          {changePct != null && (
            <span className={`sc-change ${isUp ? "sc-change--up" : "sc-change--dn"}`}>
              {isUp ? "+" : ""}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="sc-canvas"
        style={{ opacity: swrLoading ? 0.4 : 1, transition: "opacity 0.15s" }}
      />
    </div>
  );
}

function applyData(
  candles: Candle[],
  area: ISeriesApi<"Area">,
  vol: ISeriesApi<"Histogram">,
  chart: IChartApi,
  setChangePct: (v: number | null) => void,
  setEmpty: (v: boolean) => void,
  onDataChange?: (lastPrice: number | null, changePct: number | null) => void,
) {
  if (!candles.length) {
    area.setData([]);
    vol.setData([]);
    setChangePct(null);
    setEmpty(true);
    // Don't call onDataChange — keep last known price in header
    return;
  }

  setEmpty(false);

  const isIntraday = candles[0].date.includes(" ") || (candles[0].date.includes("T") && candles[0].date.includes(":"));

  area.setData(
    candles.map((c) => ({ time: toChartTime(c.date), value: c.close })) as any,
  );

  vol.setData(
    candles.map((c) => ({
      time: toChartTime(c.date),
      value: c.volume,
      color: c.close >= c.open ? "rgba(24,160,85,0.15)" : "rgba(217,64,64,0.15)",
    })) as any,
  );

  chart.timeScale().applyOptions({ timeVisible: isIntraday });
  chart.timeScale().fitContent();

  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const pct = first ? ((last - first) / first) * 100 : null;
  setChangePct(pct);
  onDataChange?.(last, pct);
}
