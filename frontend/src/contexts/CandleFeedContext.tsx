import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { CandleFeedMode } from "../types/market";
import type { CandleFeedOptions, CandleFeedResult } from "../hooks/useCandleFeed";
import { useCandleFeed } from "../hooks/useCandleFeed";

export type CandleFeedConfig = {
  symbol: string;
  timeframe: string;
  mode: CandleFeedMode | "auto";
  limit: number;
};

type CandleFeedContextValue = {
  config: CandleFeedConfig;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setMode: (mode: CandleFeedMode | "auto") => void;
  setLimit: (limit: number) => void;
  feed: CandleFeedResult;
};

const CandleFeedContext = createContext<CandleFeedContextValue | undefined>(undefined);

const DEFAULT_SYMBOL = "BTC/USDT";
const DEFAULT_TIMEFRAME = "1m";
const DEFAULT_MODE: CandleFeedMode | "auto" = "auto";
const DEFAULT_LIMIT = 720;

export function CandleFeedProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CandleFeedConfig>({ symbol: DEFAULT_SYMBOL, timeframe: DEFAULT_TIMEFRAME, mode: DEFAULT_MODE, limit: DEFAULT_LIMIT });
  const feedOptions: CandleFeedOptions = useMemo(
    () => ({
      symbol: toFeedSymbol(config.symbol),
      displaySymbol: config.symbol,
      timeframe: config.timeframe,
      forceMode: config.mode,
      limit: config.limit,
    }),
    [config],
  );
  const feed = useCandleFeed(feedOptions);

  const setSymbol = useCallback((symbol: string) => {
    setConfig((prev) => {
      const next = toDisplaySymbol(symbol);
      if (prev.symbol === next) {
        return prev;
      }
      return { ...prev, symbol: next };
    });
  }, []);

  const setTimeframe = useCallback((timeframe: string) => {
    setConfig((prev) => {
      if (prev.timeframe === timeframe) {
        return prev;
      }
      return { ...prev, timeframe };
    });
  }, []);

  const setMode = useCallback((mode: CandleFeedMode | "auto") => {
    setConfig((prev) => {
      if (prev.mode === mode) {
        return prev;
      }
      return { ...prev, mode };
    });
  }, []);

  const setLimit = useCallback((limit: number) => {
    setConfig((prev) => {
      if (prev.limit === limit) {
        return prev;
      }
      return { ...prev, limit };
    });
  }, []);

  const value = useMemo(
    () => ({
      config,
      setSymbol,
      setTimeframe,
      setMode,
      setLimit,
      feed,
    }),
    [config, setSymbol, setTimeframe, setMode, setLimit, feed],
  );

  return <CandleFeedContext.Provider value={value}>{children}</CandleFeedContext.Provider>;
}

export function useCandleFeedContext(): CandleFeedContextValue {
  const context = useContext(CandleFeedContext);
  if (!context) {
    throw new Error("useCandleFeedContext must be used within a CandleFeedProvider");
  }
  return context;
}

function toFeedSymbol(symbol: string): string {
  return symbol.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function toDisplaySymbol(symbol: string): string {
  const upper = symbol.replace(/\s+/g, "").toUpperCase();
  if (upper.includes("/")) {
    return upper;
  }
  const knownQuotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "BNB", "EUR", "GBP"]; // cover major quotes
  for (const quote of knownQuotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, upper.length - quote.length);
      return `${base}/${quote}`;
    }
  }
  return upper;
}
