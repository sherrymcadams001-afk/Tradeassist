import { useEffect, useMemo, useRef } from "react";
import { ColorType, IChartApi, ISeriesApi, UTCTimestamp, createChart } from "lightweight-charts";

import { useCandleFeed } from "../hooks/useCandleFeed";

type SymbolMiniChartProps = {
  symbol: string;
  timeframe?: string;
  height?: number;
  onFocus?: (symbol: string) => void;
  accentClass?: string;
  active?: boolean;
  className?: string;
};

export function SymbolMiniChart({
  symbol,
  timeframe = "5m",
  height = 160,
  onFocus,
  accentClass = "text-cyan-300",
  active = false,
  className = "",
}: SymbolMiniChartProps) {
  const normalizedSymbol = useMemo(() => symbol.replace(/[^a-z0-9]/gi, "").toUpperCase(), [symbol]);
  const { candles, status, mode } = useCandleFeed({
    symbol: normalizedSymbol,
    displaySymbol: symbol,
    timeframe,
    limit: 240,
    forceMode: "auto",
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#050810" },
        textColor: "#e2e8f0",
      },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
      width: containerRef.current.clientWidth,
      height,
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });

    const area = chart.addAreaSeries({
      lineColor: "rgba(34,197,94,0.9)",
      topColor: "rgba(34,197,94,0.25)",
      bottomColor: "rgba(34,197,94,0.02)",
      priceLineVisible: false,
    });

    chartRef.current = chart;
    areaSeriesRef.current = area;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      areaSeriesRef.current = null;
    };
  }, [height]);

  const normalizedCandles = useMemo(
    () =>
      candles.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
        value: candle.close,
      })),
    [candles],
  );

  useEffect(() => {
    if (!areaSeriesRef.current || !normalizedCandles.length) {
      return;
    }
    areaSeriesRef.current.setData(normalizedCandles);
  }, [normalizedCandles]);

  const latestClose = normalizedCandles[normalizedCandles.length - 1]?.value;
  const firstClose = normalizedCandles[0]?.value;
  const pctChange = latestClose && firstClose ? ((latestClose - firstClose) / firstClose) * 100 : 0;
  const trendPositive = pctChange >= 0;

  const statusDot =
    mode === "live" && status === "live" ? "bg-emerald-400" : status === "error" ? "bg-rose-500" : "bg-slate-600";

  return (
    <button
      type="button"
      onClick={() => onFocus?.(symbol)}
      className={`group flex flex-col rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/70 to-black/70 p-3 text-left shadow-lg transition hover:border-cyan-400/40 ${
        active ? "ring-1 ring-cyan-400/40" : ""
      } ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${active ? accentClass : "text-slate-200"}`}>{symbol}</p>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{timeframe}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${statusDot}`} />
            {mode === "live" ? "Live" : "Sim"}
          </p>
          <p className={`text-sm font-semibold ${trendPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {trendPositive ? "+" : ""}
            {pctChange.toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="relative h-[140px] w-full">
        <div ref={containerRef} className="h-full w-full" />
        {!normalizedCandles.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.4em] text-slate-600">
            Loading
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>Last</span>
        <span className="font-mono text-slate-100">{latestClose ? latestClose.toFixed(2) : "--"}</span>
      </div>
    </button>
  );
}
