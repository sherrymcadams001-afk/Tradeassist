import { useEffect, useRef } from "react";
import { ColorType, IChartApi, ISeriesApi, LineData, UTCTimestamp, createChart } from "lightweight-charts";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ProfessionalChartProps = {
  candles: Candle[];
  height?: number;
};

export function ProfessionalChart({ candles, height = 420 }: ProfessionalChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#e2e8f0",
      },
      grid: {
        vertLines: { color: "#111827", style: 1 },
        horzLines: { color: "#111827", style: 1 },
      },
      width: containerRef.current.clientWidth,
      height,
      crosshair: { mode: 1 },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      borderUpColor: "#22c55e",
      wickUpColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    const ema20Series = chart.addLineSeries({
      color: "#06b6d4",
      lineWidth: 2,
      title: "EMA 20",
    });

    const ema50Series = chart.addLineSeries({
      color: "#a855f7",
      lineWidth: 2,
      title: "EMA 50",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    ema20Ref.current = ema20Series;
    ema50Ref.current = ema50Series;

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
    };
  }, [height]);

  useEffect(() => {
    if (!candles.length || !candleSeriesRef.current || !ema20Ref.current || !ema50Ref.current) {
      return;
    }

    const formatted = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candleSeriesRef.current.setData(formatted);
    ema20Ref.current.setData(calculateEMA(20, formatted));
    ema50Ref.current.setData(calculateEMA(50, formatted));
  }, [candles]);

  return <div ref={containerRef} className="w-full rounded-xl border border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.45)]" />;
}

function calculateEMA(period: number, candles: { time: UTCTimestamp; close: number }[]) {
  if (candles.length < period) {
    return [] as LineData[];
  }
  const multiplier = 2 / (period + 1);
  const ema: LineData[] = [];
  let rollingSum = 0;

  for (let i = 0; i < candles.length; i++) {
    const { close, time } = candles[i];
    if (i < period) {
      rollingSum += close;
      if (i === period - 1) {
        const sma = rollingSum / period;
        ema.push({ time, value: sma });
      }
      continue;
    }

    const previous = ema[ema.length - 1]?.value ?? close;
    const nextValue = (close - previous) * multiplier + previous;
    ema.push({ time, value: nextValue });
  }

  return ema;
}
