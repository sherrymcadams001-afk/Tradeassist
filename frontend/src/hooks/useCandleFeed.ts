import { useEffect, useRef, useState } from "react";

import type { Candle, CandleFeedMode, CandleFeedStatus } from "../types/market";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const USE_REAL_DATA = String(import.meta.env.VITE_USE_REAL_DATA ?? "false").toLowerCase() === "true";
const DEFAULT_LIMIT = 200;
const BINANCE_REST = "https://api.binance.com/api/v3/klines";
const BINANCE_TICKER_24H = "https://api.binance.com/api/v3/ticker/24hr";
const BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws";
const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 2_000;

export type CandleFeedOptions = {
  symbol: string;
  displaySymbol?: string;
  timeframe?: string;
  limit?: number;
  forceMode?: CandleFeedMode | "auto";
};

export type CandleFeedResult = {
  candles: Candle[];
  status: CandleFeedStatus;
  mode: CandleFeedMode;
  error: string | null;
};

export function useCandleFeed({ symbol, displaySymbol, timeframe = "1m", limit = DEFAULT_LIMIT, forceMode = "auto" }: CandleFeedOptions): CandleFeedResult {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<CandleFeedStatus>("idle");
  const [mode, setMode] = useState<CandleFeedMode>(resolveMode(forceMode));
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const resolvedMode = resolveMode(forceMode);
    setMode(resolvedMode);
    setCandles([]);

    const teardown = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.removeEventListener("close", handleSocketClose);
        wsRef.current.removeEventListener("error", handleSocketError);
        wsRef.current.removeEventListener("message", handleSocketMessage as EventListener);
        wsRef.current.close(4001, "cleanup");
        wsRef.current = null;
      }
    };

    const handleSocketMessage = (event: MessageEvent) => {
      if (cancelled) {
        return;
      }
      try {
        const payload = JSON.parse(event.data as string) as BinanceStreamEnvelope;
        if (!payload || payload.e !== "kline") {
          return;
        }
        const candle = mapWsKline(payload.k);
        setCandles((prev) => mergeCandles(prev, candle, limit));
      } catch (socketError) {
        console.error("Malformed kline payload", socketError);
      }
    };

    const scheduleReconnect = (attemptMode: CandleFeedMode) => {
      if (cancelled) {
        return;
      }
      retryRef.current += 1;
      const delay = Math.min(MAX_RECONNECT_DELAY, INITIAL_RECONNECT_DELAY * 2 ** (retryRef.current - 1));
      reconnectTimerRef.current = window.setTimeout(() => {
        if (attemptMode === "live") {
          void bootstrapLive();
        } else {
          void bootstrapSimulated();
        }
      }, delay);
    };

    const handleSocketClose = (event: CloseEvent) => {
      if (cancelled) {
        return;
      }
      if (event.code === 4001 || event.code === 1000) {
        return; // graceful shutdown
      }
      setStatus("connecting");
      scheduleReconnect("live");
    };

    const handleSocketError = () => {
      if (cancelled) {
        return;
      }
      setStatus("error");
      setError("Live feed error");
      teardown();
      scheduleReconnect("live");
    };

    const bootstrapLive = async () => {
      setStatus("connecting");
      setMode("live");
      setError(null);
      retryRef.current = 0;
      try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const history = await fetchHistory(normalizedSymbol, timeframe, limit);
        if (cancelled) {
          return;
        }
        setCandles(history);
        const ws = new WebSocket(buildWsUrl(normalizedSymbol, timeframe));
        wsRef.current = ws;
        ws.addEventListener("open", () => {
          if (!cancelled) {
            setStatus("live");
            setError(null);
          }
        });
        ws.addEventListener("message", handleSocketMessage as EventListener);
        ws.addEventListener("close", handleSocketClose);
        ws.addEventListener("error", handleSocketError);
      } catch (liveError) {
        console.error("Live candle bootstrap failed", liveError);
        if (cancelled) {
          return;
        }
        setError(liveError instanceof Error ? liveError.message : "Unable to connect to live feed");
        setStatus("fallback");
        setMode("simulated");
        retryRef.current = 0;
        await bootstrapSimulated();
      }
    };

    const bootstrapSimulated = async () => {
      setStatus("connecting");
      setMode("simulated");
      setError(null);
      retryRef.current = 0;
      try {
        const fallbackSymbol = (displaySymbol ?? denormalizeSymbol(symbol)).toUpperCase();
        const candlesPayload = await fetchSimulated(fallbackSymbol, limit, timeframe);
        if (cancelled) {
          return;
        }
        setCandles(candlesPayload);
        setStatus("live");
        // poll every 15 seconds to keep data fresh
        reconnectTimerRef.current = window.setInterval(async () => {
          try {
            const refreshed = await fetchSimulated(fallbackSymbol, limit, timeframe);
            if (!cancelled) {
              setCandles(refreshed);
            }
          } catch (pollError) {
            console.error("Simulated candle refresh failed", pollError);
          }
        }, 15_000) as unknown as number;
      } catch (simError) {
        console.error("Simulated candle bootstrap failed", simError);
        if (!cancelled) {
          setError(simError instanceof Error ? simError.message : "Unable to load simulated data");
          setStatus("error");
        }
      }
    };

    teardown();

    if (resolvedMode === "live") {
      void bootstrapLive();
    } else {
      void bootstrapSimulated();
    }

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(4001, "component_unmount");
        wsRef.current = null;
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, limit, forceMode]);

  return { candles, status, mode, error };
}

function resolveMode(forceMode: CandleFeedMode | "auto"): CandleFeedMode {
  if (forceMode === "auto") {
    return USE_REAL_DATA ? "live" : "simulated";
  }
  return forceMode;
}

async function fetchHistory(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
  const url = `${BINANCE_REST}?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance history request failed (${response.status})`);
  }
  const payload = (await response.json()) as BinanceRestKline[];
  return payload.map(mapRestKline);
}

async function fetchSimulated(symbol: string, limit: number, timeframe: string): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, limit: String(limit) });
  const response = await fetch(`${API_BASE}/api/ohlcv?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Simulated OHLCV request failed (${response.status})`);
  }
  const payload = (await response.json()) as { candles?: SimulatedCandle[] };
  const timeframeMs = timeframeToMs(timeframe);
  const candles = (payload.candles ?? []).map((entry) => ({
    openTime: entry.time * 1000,
    closeTime: entry.time * 1000 + timeframeMs,
    open: entry.open,
    high: entry.high,
    low: entry.low,
    close: entry.close,
    volume: entry.volume ?? 0,
    isClosed: true,
  } satisfies Candle));
  return candles.slice(-limit);
}

function mergeCandles(existing: Candle[], incoming: Candle, limit: number): Candle[] {
  const next = existing.filter((item) => item.openTime !== incoming.openTime);
  next.push(incoming);
  next.sort((a, b) => a.openTime - b.openTime);
  if (next.length > limit) {
    next.splice(0, next.length - limit);
  }
  return next;
}

function mapRestKline(entry: BinanceRestKline): Candle {
  return {
    openTime: entry[0],
    open: parseFloat(entry[1]),
    high: parseFloat(entry[2]),
    low: parseFloat(entry[3]),
    close: parseFloat(entry[4]),
    volume: parseFloat(entry[5]),
    closeTime: entry[6],
    isClosed: true,
  } satisfies Candle;
}

function mapWsKline(entry: BinanceWsKline): Candle {
  return {
    openTime: entry.t,
    open: parseFloat(entry.o),
    high: parseFloat(entry.h),
    low: parseFloat(entry.l),
    close: parseFloat(entry.c),
    volume: parseFloat(entry.v),
    closeTime: entry.T,
    isClosed: entry.x,
  } satisfies Candle;
}

function buildWsUrl(symbol: string, timeframe: string): string {
  return `${BINANCE_WS_BASE}/${symbol.toLowerCase()}@kline_${timeframe}`;
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function denormalizeSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    return symbol.toUpperCase();
  }
  const upper = symbol.toUpperCase();
  const knownQuotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "BNB", "EUR", "GBP"];
  for (const quote of knownQuotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, upper.length - quote.length);
      return `${base}/${quote}`;
    }
  }
  if (upper.length > 3) {
    return `${upper.slice(0, upper.length - 3)}/${upper.slice(-3)}`;
  }
  return upper;
}

function timeframeToMs(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 60_000;
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const factors: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (factors[unit] ?? 60_000);
}

type BinanceRestKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
  string
];

type BinanceWsKline = {
  t: number;
  T: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  x: boolean;
};

type BinanceStreamEnvelope = {
  e: "kline" | string;
  k: BinanceWsKline;
};

type SimulatedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
