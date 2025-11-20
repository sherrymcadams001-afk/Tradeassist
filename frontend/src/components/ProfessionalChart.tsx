import { useEffect, useRef } from "react";
import { ColorType, CrosshairMode, IChartApi, ISeriesApi, LineData, LineStyle, UTCTimestamp, createChart } from "lightweight-charts";

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
  const visionEntryRef = useRef<ISeriesApi<"Line"> | null>(null);
  const visionExitRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#020617" },
        textColor: "#f8fafc",
      },
      grid: {
        vertLines: { color: "rgba(15,23,42,0.7)", style: 1 },
        horzLines: { color: "rgba(15,23,42,0.7)", style: 1 },
      },
      width: containerRef.current.clientWidth,
      height,
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        borderColor: "rgba(148,163,184,0.2)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: { priceFormatter: (price: number) => price.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "rgba(16,185,129,0.9)",
      borderUpColor: "rgba(16,185,129,1)",
      wickUpColor: "rgba(16,185,129,0.8)",
      downColor: "rgba(239,68,68,0.9)",
      borderDownColor: "rgba(239,68,68,1)",
      wickDownColor: "rgba(239,68,68,0.8)",
      borderVisible: false,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    const ema20Series = chart.addLineSeries({
      color: "rgba(6,182,212,1)",
      lineWidth: 2,
      title: "EMA 20",
      priceLineVisible: false,
    });

    const ema50Series = chart.addLineSeries({
      color: "rgba(168,85,247,1)",
      lineWidth: 2,
      title: "EMA 50",
      priceLineVisible: false,
    });

    const botVisionEntrySeries = chart.addLineSeries({
      color: "rgba(251,191,36,0.9)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "Bot Vision Entry",
      priceLineVisible: false,
    });

    const botVisionExitSeries = chart.addLineSeries({
      color: "rgba(248,113,113,0.9)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "Bot Vision Exit",
      priceLineVisible: false,
    });

    chart.applyOptions({
      watermark: {
        visible: true,
        fontSize: 24,
        horzAlign: "right",
        vertAlign: "bottom",
        color: "rgba(148,163,184,0.15)",
        text: "MIDAS TOUCH · BOT VISION",
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    ema20Ref.current = ema20Series;
    ema50Ref.current = ema50Series;
    visionEntryRef.current = botVisionEntrySeries;
    visionExitRef.current = botVisionExitSeries;

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
    if (!candles.length || !candleSeriesRef.current || !ema20Ref.current || !ema50Ref.current || !visionEntryRef.current || !visionExitRef.current) {
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
    const botVisionPaths = calculateBotVisionPaths(formatted);
    visionEntryRef.current.setData(botVisionPaths.entryPath);
    visionExitRef.current.setData(botVisionPaths.exitPath);

    if (formatted.length) {
      const last = formatted[formatted.length - 1];
      if (priceLineRef.current) {
        candleSeriesRef.current.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
      }
      priceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: last.close,
        color: "rgba(248,250,252,0.6)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Last",
        lineVisible: true,
      });
    }
  }, [candles]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 via-black to-slate-950 shadow-[0_0_60px_rgba(15,23,42,0.65)]"
    />
  );
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

function calculateBotVisionPaths(candles: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[]) {
  if (!candles.length) {
    return { entryPath: [] as LineData[], exitPath: [] as LineData[] };
  }
  const entryPath: LineData[] = [];
  const exitPath: LineData[] = [];
  candles.forEach((bar, idx) => {
    const bias = Math.sin(idx / 6) * 0.0015 * bar.close;
    const entry = bar.close - (bar.close - bar.low) * 0.25 + bias;
    const exit = bar.close + (bar.high - bar.close) * 0.25 - bias;
    entryPath.push({ time: bar.time, value: entry });
    exitPath.push({ time: bar.time, value: exit });
  });
  return { entryPath, exitPath };
}
