import { useEffect, useState } from "react";

const BINANCE_TICKER_24H = "https://api.binance.com/api/v3/ticker/24hr";
const BINANCE_MINI_TICKER_WS = "wss://stream.binance.com:9443/ws/!miniTicker@arr";
const UPDATE_INTERVAL = 10_000; // 10 seconds for REST fallback

export type Ticker24hr = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
};

export type TickerData = {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

type UseBinanceTickerOptions = {
  symbols: string[];
  useWebSocket?: boolean;
};

export function useBinanceTicker({ symbols, useWebSocket = true }: UseBinanceTickerOptions) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let intervalId: number | null = null;

    const normalizedSymbols = symbols.map((s) => s.replace(/[^a-z0-9]/gi, "").toUpperCase());

    const fetchRest = async () => {
      try {
        const symbolParam = normalizedSymbols.map((s) => `"${s}"`).join(",");
        const url = `${BINANCE_TICKER_24H}?symbols=[${symbolParam}]`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Ticker request failed: ${response.status}`);
        }

        const data = (await response.json()) as Ticker24hr[];
        
        if (cancelled) return;

        const tickerMap: Record<string, TickerData> = {};
        data.forEach((ticker) => {
          const displaySymbol = denormalizeSymbol(ticker.symbol);
          tickerMap[displaySymbol] = {
            symbol: displaySymbol,
            price: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.quoteVolume),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice),
          };
        });

        setTickers(tickerMap);
        setConnected(true);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch 24hr tickers:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch tickers");
          setConnected(false);
        }
      }
    };

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(BINANCE_MINI_TICKER_WS);

        ws.addEventListener("open", () => {
          if (!cancelled) {
            setConnected(true);
            setError(null);
          }
        });

        ws.addEventListener("message", (event) => {
          if (cancelled) return;

          try {
            const miniTickers = JSON.parse(event.data) as Array<{
              s: string; // symbol
              c: string; // close price
              h: string; // high
              l: string; // low
              v: string; // volume
              q: string; // quote volume
            }>;

            const tickerMap: Record<string, TickerData> = {};
            
            miniTickers.forEach((ticker) => {
              if (normalizedSymbols.includes(ticker.s)) {
                const displaySymbol = denormalizeSymbol(ticker.s);
                const currentTicker = tickers[displaySymbol];
                const oldPrice = currentTicker?.price ?? parseFloat(ticker.c);
                const newPrice = parseFloat(ticker.c);
                const change = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

                tickerMap[displaySymbol] = {
                  symbol: displaySymbol,
                  price: newPrice,
                  change24h: change,
                  volume24h: parseFloat(ticker.q),
                  high24h: parseFloat(ticker.h),
                  low24h: parseFloat(ticker.l),
                };
              }
            });

            if (Object.keys(tickerMap).length > 0) {
              setTickers((prev) => ({ ...prev, ...tickerMap }));
            }
          } catch (err) {
            console.error("Failed to parse mini ticker:", err);
          }
        });

        ws.addEventListener("error", () => {
          if (!cancelled) {
            setError("WebSocket connection error");
            setConnected(false);
          }
        });

        ws.addEventListener("close", () => {
          if (!cancelled) {
            setConnected(false);
            // Reconnect after 5 seconds
            setTimeout(() => {
              if (!cancelled && useWebSocket) {
                connectWebSocket();
              }
            }, 5000);
          }
        });
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
        if (!cancelled) {
          setError("Failed to connect WebSocket");
          // Fall back to REST
          void fetchRest();
          intervalId = window.setInterval(fetchRest, UPDATE_INTERVAL);
        }
      }
    };

    // Initial fetch
    void fetchRest();

    if (useWebSocket) {
      connectWebSocket();
    } else {
      // REST polling fallback
      intervalId = window.setInterval(fetchRest, UPDATE_INTERVAL);
    }

    return () => {
      cancelled = true;
      if (ws) {
        ws.close();
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [symbols.join(","), useWebSocket]);

  return { tickers, connected, error };
}

function denormalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  const knownQuotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "BNB"];
  for (const quote of knownQuotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, upper.length - quote.length);
      return `${base}/${quote}`;
    }
  }
  return upper;
}
