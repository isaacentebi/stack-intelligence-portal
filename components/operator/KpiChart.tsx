"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, type IChartApi } from "lightweight-charts";

type Props = {
  history: { period: string; value: number }[];
  color: string;
  height?: number;
};

export function KpiChart({ history, color, height = 120 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sorted = [...history]
      .filter((h) => h.value != null && isFinite(h.value))
      .sort((a, b) => a.period.localeCompare(b.period));

    if (sorted.length < 2) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#ccc",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#f5f5f5" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.02 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: "#e0e0e0", width: 1, style: 3, labelVisible: false },
        horzLine: { color: "#e0e0e0", width: 1, style: 3, labelBackgroundColor: "#444" },
      },
    });

    // Ensure 6-char hex for opacity suffixes
    const c6 = color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;

    const area = chart.addSeries(AreaSeries, {
      lineColor: c6,
      topColor: c6 + "15",
      bottomColor: c6 + "02",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: c6,
      crosshairMarkerBorderColor: "#fff",
      crosshairMarkerBorderWidth: 1,
    });

    area.setData(
      sorted.map((h) => ({ time: h.period.split("T")[0] as string, value: h.value })) as any,
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [history, color]);

  const hasData = history?.filter((h) => h.value != null && isFinite(h.value)).length >= 2;

  if (!hasData) {
    return <div style={{ height, background: "#fafafa", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#ccc" }}>Insufficient data</div>;
  }

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
