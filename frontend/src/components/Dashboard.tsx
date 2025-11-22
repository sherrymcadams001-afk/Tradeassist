import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, TrendingUp, TrendingDown, BookOpen } from "lucide-react";

import { ProfessionalChart } from "./ProfessionalChart";
import BotAvatar from "./BotAvatar";
import BotNotification from "./BotNotification";
import OrderBook from "./OrderBook";
import { SymbolMiniChart } from "./SymbolMiniChart";
import { useMarketStream } from "../hooks/useMarketStream";
import { useCandleFeedContext } from "../contexts/CandleFeedContext";
import { useBinanceTicker } from "../hooks/useBinanceTicker";
import { useBotSimulation, type BotTimingConfig } from "../hooks/useBotSimulation";
import { useSmartAlerts, type AlertTimingConfig } from "../hooks/useSmartAlerts";
import type { BotMessage, MessageCategory } from "../utils/botMessages";
import type { BotDescriptor, TierDefinition, UserProfile } from "../types/bot";

type ActiveOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filled: number;
  status: "FILLED" | "PARTIAL" | "PENDING";
};

type MarketTick = {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
};

type DashboardProps = {
  bot?: BotDescriptor | null;
  profile?: UserProfile;
  tier?: TierDefinition;
};

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/prices";
const MARKET_SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "LINK/USDT", "ATOM/USDT", "AVAX/USDT", "MATIC/USDT"];
const MINI_TIMEFRAMES = ["1m", "5m", "15m", "1h"];

const CATEGORY_BADGES: Record<
  MessageCategory,
  { label: string; bg: string; border: string; accent: string; text: string }
> = {
  market_scanning: {
    label: "Market Scan",
    bg: "from-slate-900/80 via-blue-900/20 to-black/60",
    border: "border-blue-500/30",
    accent: "bg-blue-500/20 text-blue-200",
    text: "text-blue-100",
  },
  trade_execution: {
    label: "Execution",
    bg: "from-emerald-900/50 via-emerald-700/20 to-black/70",
    border: "border-emerald-500/30",
    accent: "bg-emerald-500/20 text-emerald-100",
    text: "text-emerald-50",
  },
  risk_management: {
    label: "Risk",
    bg: "from-rose-900/60 via-rose-700/20 to-black/70",
    border: "border-rose-500/30",
    accent: "bg-rose-500/20 text-rose-100",
    text: "text-rose-50",
  },
  technical_analysis: {
    label: "Technical",
    bg: "from-purple-900/60 via-purple-700/20 to-black/70",
    border: "border-purple-500/30",
    accent: "bg-purple-500/20 text-purple-100",
    text: "text-purple-50",
  },
  order_management: {
    label: "Order Flow",
    bg: "from-amber-900/50 via-amber-700/20 to-black/70",
    border: "border-amber-500/30",
    accent: "bg-amber-500/20 text-amber-100",
    text: "text-amber-50",
  },
  portfolio_actions: {
    label: "Portfolio",
    bg: "from-cyan-900/50 via-cyan-700/20 to-black/70",
    border: "border-cyan-500/30",
    accent: "bg-cyan-500/20 text-cyan-100",
    text: "text-cyan-50",
  },
  advanced_signals: {
    label: "Signals",
    bg: "from-fuchsia-900/60 via-fuchsia-700/20 to-black/70",
    border: "border-fuchsia-500/30",
    accent: "bg-fuchsia-500/20 text-fuchsia-100",
    text: "text-fuchsia-50",
  },
};

const DEFAULT_CATEGORY_THEME = {
  label: "Market",
  bg: "from-slate-900/70 via-slate-800/40 to-black/70",
  border: "border-slate-600/40",
  accent: "bg-slate-500/30 text-slate-100",
  text: "text-slate-100",
};

type TimingProfile = "calm" | "balanced" | "dynamic";

const TIMING_PRESETS: Record<
  TimingProfile,
  {
    logs: Partial<BotTimingConfig>;
    alerts: Partial<AlertTimingConfig>;
  }
> = {
  calm: {
    logs: {
      baseInterval: 15000,
      variance: 0.25,
      burst: { probability: 0.1, lengthRange: [2, 3], multiplierRange: [0.25, 0.55] },
      calm: { probability: 0.2, lengthRange: [2, 4], multiplierRange: [1.8, 2.4] },
    },
    alerts: {
      baseInterval: 22000,
      variance: 0.25,
      burst: { probability: 0.12, lengthRange: [2, 3], multiplierRange: [0.3, 0.6] },
      calm: { probability: 0.22, lengthRange: [2, 4], multiplierRange: [1.7, 2.5] },
    },
  },
  balanced: {
    logs: {
      baseInterval: 12000,
      variance: 0.35,
    },
    alerts: {
      baseInterval: 18000,
      variance: 0.35,
    },
  },
  dynamic: {
    logs: {
      baseInterval: 9000,
      variance: 0.45,
      burst: { probability: 0.28, lengthRange: [3, 5], multiplierRange: [0.15, 0.45] },
      calm: { probability: 0.08, lengthRange: [1, 2], multiplierRange: [1.2, 1.6] },
    },
    alerts: {
      baseInterval: 14000,
      variance: 0.45,
      burst: { probability: 0.32, lengthRange: [3, 5], multiplierRange: [0.15, 0.4] },
      calm: { probability: 0.1, lengthRange: [1, 2], multiplierRange: [1.1, 1.4] },
    },
  },
};

export function Dashboard({ bot, profile, tier }: DashboardProps) {
  const {
    feed: { candles, status: candleStatus, mode: candleMode },
    config,
    setSymbol,
  } = useCandleFeedContext();
  const { ticks, connected } = useMarketStream({ url: WS_URL, symbols: MARKET_SYMBOLS });
  const { tickers } = useBinanceTicker({ symbols: MARKET_SYMBOLS, useWebSocket: true });
  const timingProfile: TimingProfile = profile?.preferences?.timing_profile ?? "balanced";
  const timingOverrides = TIMING_PRESETS[timingProfile];
  const { messages, isActive, marketCondition } = useBotSimulation({
    symbols: MARKET_SYMBOLS,
    enabled: true,
    messageInterval: timingOverrides.logs.baseInterval ?? 8000,
    timingConfig: timingOverrides.logs,
  });
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [marketData, setMarketData] = useState<MarketTick[]>([]);
  const [pnl, setPnl] = useState<number>(0);
  const [baselinePrice, setBaselinePrice] = useState<number | null>(null);
  const selectedSymbol = config.symbol;
  const [focusLockUntil, setFocusLockUntil] = useState<number>(0);
  const rotationTimerRef = useRef<number | null>(null);
  const rotationScheduleRef = useRef<{ nextRun: number | null }>({ nextRun: null });
  const [rotationEtaMs, setRotationEtaMs] = useState<number | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [viewport, setViewport] = useState(() => ({
    isCompact: typeof window !== "undefined" ? window.innerWidth < 768 : false,
    isTablet: typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        isCompact: window.innerWidth < 768,
        isTablet: window.innerWidth < 1024,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const { isCompact: isCompactLayout, isTablet: isTabletLayout } = viewport;

  const focusSymbol = useCallback(
    (symbol: string, holdDuration = 0) => {
      if (!symbol) return;
      const next = symbol.toUpperCase();
      setSymbol(next);
      if (holdDuration > 0) {
        setFocusLockUntil(Date.now() + holdDuration);
      }
    },
    [setSymbol],
  );

  const handleManualSymbol = useCallback(
    (symbol: string) => {
      focusSymbol(symbol, 90_000); // 90s manual hold
    },
    [focusSymbol],
  );

  const topActiveSymbols = useMemo(() => {
    if (messages.length === 0) {
      return [] as string[];
    }
    const counts = new Map<string, number>();
    const recent = messages.slice(-40);
    recent.forEach((message, idx) => {
      if (!message.symbol) return;
      const weight = message.priority === "high" ? 2 : 1;
      const decay = (recent.length - idx) * 0.05;
      counts.set(message.symbol, (counts.get(message.symbol) ?? 0) + weight + decay);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([symbol]) => symbol)
      .filter((symbol) => MARKET_SYMBOLS.includes(symbol));
  }, [messages]);

  const latestSymbolAction = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (candidate.symbol === selectedSymbol) {
        return candidate;
      }
    }
    return null;
  }, [messages, selectedSymbol]);
  const latestActionTime = useMemo(() => {
    if (!latestSymbolAction) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(latestSymbolAction.timestamp);
    } catch (err) {
      return latestSymbolAction.timestamp?.toString() ?? null;
    }
  }, [latestSymbolAction]);
  const allocationLimit = profile?.preferences?.max_allocation ?? tier?.max_allocation ?? 10000;

  const { alerts, dismissAlert } = useSmartAlerts({
    symbols: MARKET_SYMBOLS,
    selectedSymbol,
    marketCondition,
    pnl,
    allocationLimit,
    tickers,
    enabled: true,
    timingConfig: timingOverrides.alerts,
  });

  // Initialize with first market symbol on mount
  useEffect(() => {
    if (!selectedSymbol || !MARKET_SYMBOLS.includes(selectedSymbol)) {
      setSymbol(MARKET_SYMBOLS[0]);
    }
  }, [selectedSymbol, setSymbol]);

  // Derive market data from Binance tickers (REAL DATA)
  useEffect(() => {
    const data = MARKET_SYMBOLS.map((symbol) => {
      const ticker = tickers[symbol];
      if (!ticker) return null;
      
      return {
        symbol,
        price: ticker.price,
        change24h: ticker.change24h,
        volume24h: ticker.volume24h,
      };
    }).filter((item): item is MarketTick => item !== null);
    
    setMarketData(data);
  }, [tickers]);

  // Generate realistic orders based on current price
  useEffect(() => {
    const tickerData = tickers[selectedSymbol];
    const currentPrice = tickerData?.price ?? ticks[selectedSymbol]?.last ?? ticks[selectedSymbol]?.price;
    if (!currentPrice) return;

    const mockOrders: ActiveOrder[] = [
      {
        id: "1",
        symbol: selectedSymbol,
        side: "BUY",
        price: currentPrice * 0.998,
        quantity: 0.05,
        filled: 0.05,
        status: "FILLED",
      },
      {
        id: "2",
        symbol: selectedSymbol,
        side: "SELL",
        price: currentPrice * 1.002,
        quantity: 0.05,
        filled: 0,
        status: "PENDING",
      },
      {
        id: "3",
        symbol: selectedSymbol,
        side: "BUY",
        price: currentPrice * 0.995,
        quantity: 0.1,
        filled: 0.05,
        status: "PARTIAL",
      },
    ];
    setOrders(mockOrders);
  }, [selectedSymbol, ticks, tickers]);

  // Calculate PnL
  useEffect(() => {
    if (!candles.length) {
      setBaselinePrice(null);
      return;
    }
    if (!baselinePrice) {
      setBaselinePrice(candles[0].close);
    }
  }, [candles, baselinePrice]);

  useEffect(() => {
    if (!baselinePrice) {
      setPnl(0);
      return;
    }
    const tickerData = tickers[selectedSymbol];
    const currentPrice = tickerData?.price ?? candles[candles.length - 1]?.close ?? baselinePrice;
    const priceChange = ((currentPrice - baselinePrice) / baselinePrice);
    const calculatedPnl = priceChange * allocationLimit;
    setPnl(calculatedPnl);
  }, [baselinePrice, candles, allocationLimit, selectedSymbol, tickers]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === lastMessageRef.current || !latest.symbol) {
      return;
    }
    lastMessageRef.current = latest.id;
    if (Date.now() < focusLockUntil) {
      return;
    }
    const burstWindow = messages.slice(-4);
    const burstHits = burstWindow.filter((msg) => msg.symbol === latest.symbol);
    const burstDetected = burstHits.length >= 3;
    if (latest.priority === "high" || burstDetected) {
      const holdDuration = latest.priority === "high" ? 75_000 : 45_000;
      focusSymbol(latest.symbol, holdDuration);
    }
  }, [focusLockUntil, focusSymbol, messages]);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      const baseInterval =
        marketCondition.volatility === "high" ? 18_000 : marketCondition.volatility === "low" ? 32_000 : 24_000;
      const variance = baseInterval * (0.7 + Math.random() * 0.6);
      if (rotationTimerRef.current) {
        window.clearTimeout(rotationTimerRef.current);
      }
      rotationTimerRef.current = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        rotationScheduleRef.current.nextRun = null;
        setRotationEtaMs(null);
        if (Date.now() < focusLockUntil) {
          scheduleNext();
          return;
        }
        const pool = topActiveSymbols.length > 0 ? topActiveSymbols : MARKET_SYMBOLS;
        const candidates = pool.filter((symbol) => symbol !== selectedSymbol);
        const target = candidates[Math.floor(Math.random() * candidates.length)] ?? selectedSymbol;
        if (target && target !== selectedSymbol) {
          focusSymbol(target, 35_000);
        }
        scheduleNext();
      }, variance);
      rotationScheduleRef.current.nextRun = Date.now() + variance;
      setRotationEtaMs(variance);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (rotationTimerRef.current) {
        window.clearTimeout(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
      rotationScheduleRef.current.nextRun = null;
      setRotationEtaMs(null);
    };
  }, [focusLockUntil, focusSymbol, marketCondition.volatility, selectedSymbol, topActiveSymbols]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const target = rotationScheduleRef.current.nextRun;
      if (!target) {
        setRotationEtaMs(null);
        return;
      }
      const remaining = target - Date.now();
      setRotationEtaMs(remaining > 0 ? remaining : 0);
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Prioritize ticker data for consistency with market list
  const tickerData = tickers[selectedSymbol];
  const currentPrice = tickerData?.price ?? 
    ticks[selectedSymbol]?.last ?? 
    ticks[selectedSymbol]?.price ?? 
    candles[candles.length - 1]?.close ?? 0;
  const isLive = candleMode === "live" && candleStatus === "live";
  const focusHoldSeconds = Math.max(0, Math.round((focusLockUntil - Date.now()) / 1000));
  const rotationLocked = focusHoldSeconds > 0;
  const rotationBadgeClass = rotationLocked
    ? "bg-amber-500/20 text-amber-100 border border-amber-500/20"
    : "bg-emerald-500/20 text-emerald-100 border border-emerald-500/20";
  const rotationSubtitle = rotationLocked
    ? `Manual focus for ~${Math.max(15, Math.ceil(focusHoldSeconds / 15) * 15)}s`
    : "Auto-tracking hottest symbols";
  const latestActionTheme = latestSymbolAction
    ? CATEGORY_BADGES[latestSymbolAction.category]
    : DEFAULT_CATEGORY_THEME;
  const miniPanelSymbols = useMemo(() => {
    const prioritized = topActiveSymbols.filter((symbol) => symbol !== selectedSymbol);
    const fillers = MARKET_SYMBOLS.filter((symbol) => symbol !== selectedSymbol && !prioritized.includes(symbol));
    return [...prioritized, ...fillers].slice(0, 3);
  }, [selectedSymbol, topActiveSymbols]);
  const chartHeight = isCompactLayout ? 300 : isTabletLayout ? 380 : 420;
  const miniChartHeight = isCompactLayout ? 130 : isTabletLayout ? 150 : 165;
  const renderMiniCharts = useCallback(
    (variant: "grid" | "carousel") =>
      miniPanelSymbols.map((symbol, idx) => (
        <SymbolMiniChart
          key={`${variant}-${symbol}-${idx}`}
          symbol={symbol}
          timeframe={MINI_TIMEFRAMES[idx % MINI_TIMEFRAMES.length]}
          onFocus={(sym) => focusSymbol(sym, 45_000)}
          accentClass="text-cyan-300"
          active={symbol === selectedSymbol}
          height={variant === "carousel" ? Math.max(120, miniChartHeight - 5) : miniChartHeight}
          className={variant === "carousel" ? "min-w-[230px] flex-shrink-0 snap-start" : ""}
        />
      )),
    [focusSymbol, miniChartHeight, miniPanelSymbols, selectedSymbol] // MINI_TIMEFRAMES is module-level constant
  );

  return (
    <main className="min-h-dvh bg-[#0B0C10] px-3 pt-4 pb-28 font-mono text-slate-100 sm:px-4 sm:pb-16 sm:pt-6 lg:px-6 lg:pb-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/50 to-black/60 px-4 py-5 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-4">
            <BotAvatar
              isActive={isActive}
              marketCondition=
                {marketCondition.volatility === "high"
                  ? "volatile"
                  : marketCondition.trend !== "sideways"
                    ? "trending"
                    : marketCondition.volatility === "low"
                      ? "ranging"
                      : "stable"}
              className="shrink-0"
            />
            <div className="flex flex-col justify-center">
              <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-200/70">Orion Suite</p>
              <h1 className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-3xl font-bold leading-none tracking-tight text-transparent">
                Trading Intelligence
              </h1>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">Adaptive market command</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-black/40 px-4 py-2 text-xs uppercase tracking-wider text-slate-300">
              <div className={`h-2.5 w-2.5 rounded-full ${connected && isLive ? "bg-emerald-400" : "bg-amber-400"}`} />
              {connected && isLive ? "Live markets" : "Simulated feed"}
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-black/40 px-4 py-2 text-center text-xs uppercase tracking-[0.4em] text-slate-400">
              {tier?.label ?? "Foundation"}
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-black/30 px-4 py-2 text-center text-xs uppercase tracking-[0.3em] text-slate-400">
              {rotationLocked ? "Focus Hold" : "Auto Sweep"}
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Chart and analytics column */}
          <div className="w-full space-y-6 lg:col-span-8">
            <div className="rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-black/60 p-4 shadow-[0_0_60px_rgba(6,182,212,0.15)] backdrop-blur-sm sm:p-6">
              <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">{selectedSymbol}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] ${rotationBadgeClass}`}>
                      {rotationLocked ? "Focus Locked" : "Auto Rotation"}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400 sm:text-3xl">{currentPrice.toFixed(2)} USDT</p>
                  <div
                    className={`mt-3 w-full max-w-xl rounded-2xl border px-4 py-2 text-left text-xs shadow-inner ${latestActionTheme.border} bg-gradient-to-r ${latestActionTheme.bg}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.35em]">
                      <span className={`${latestActionTheme.accent}`}>{latestActionTheme.label}</span>
                      {latestActionTime && (
                        <span className="text-slate-400/80 tracking-[0.25em]">{latestActionTime}</span>
                      )}
                    </div>
                    <p className={`mt-2 text-[12px] leading-relaxed text-slate-100/90 ${latestActionTheme.text} break-words`}>
                      {latestSymbolAction ? latestSymbolAction.content : "Awaiting contextual signal"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Symbol Focus</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 lg:justify-end">
                    <span>{rotationSubtitle}</span>
                    {rotationLocked && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-200">
                        {focusHoldSeconds}s
                      </span>
                    )}
                    {!rotationLocked && rotationEtaMs !== null && (
                      <span className="text-slate-500/80">
                        Next sweep in ~{Math.max(5, Math.round(Math.max(rotationEtaMs, 0) / 1000 / 5) * 5)}s
                      </span>
                    )}
                  </div>
                  <div className="w-full lg:w-auto">
                    <div className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-1 pl-1 pr-4 text-nowrap snap-x snap-mandatory lg:m-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0 lg:pl-0 lg:pr-0 lg:snap-none">
                      {MARKET_SYMBOLS.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => handleManualSymbol(symbol)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition snap-start ${
                            symbol === selectedSymbol
                              ? "bg-cyan-500/20 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                          }`}
                        >
                          {symbol.split("/")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="min-h-[320px] sm:min-h-[420px]">
                <ProfessionalChart height={chartHeight} />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Performance</p>
                  <p className={`text-3xl font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(2)} USDT
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Capital</p>
                  <p className="text-xl font-semibold text-white">{allocationLimit.toLocaleString()} USDT</p>
                </div>
              </div>
            </div>

            {miniPanelSymbols.length > 0 ? (
              <>
                <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
                  {renderMiniCharts("grid")}
                </div>
                <div className="-mx-1 md:hidden">
                  <div className="flex gap-3 overflow-x-auto pb-1 pl-1 pr-4 snap-x snap-mandatory">
                    {renderMiniCharts("carousel")}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-4 text-sm text-slate-400">
                Charts will populate as soon as activity is detected.
              </div>
            )}
          </div>

          {/* Right Sidebar - 4 columns */}
          <div className="w-full space-y-6 lg:col-span-4">
          {/* Market Data */}
          <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-black/60 shadow-[0_0_40px_rgba(99,102,241,0.12)] backdrop-blur-sm">
            <div className="border-b border-slate-800/80 bg-slate-900/40 px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-200">
                <Activity className="h-4 w-4 text-cyan-400" />
                Markets
              </h3>
            </div>
            <div className="custom-scrollbar max-h-[280px] overflow-y-auto sm:max-h-[350px]">
              {marketData.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => handleManualSymbol(item.symbol)}
                  className={`w-full border-b border-slate-800/40 px-5 py-3.5 text-left transition-all duration-200 hover:bg-slate-800/40 ${
                    item.symbol === selectedSymbol ? "bg-cyan-500/15 border-l-4 border-l-cyan-400" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{item.symbol.split("/")[0]}</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{item.price.toFixed(2)}</p>
                      <p
                        className={`flex items-center gap-1 text-xs ${
                          item.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {item.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(item.change24h).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Order Book */}
          <div className="rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-black/60 shadow-[0_0_40px_rgba(99,102,241,0.12)] backdrop-blur-sm">
            <div className="border-b border-slate-800/80 bg-slate-900/40 px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-200">
                <BookOpen className="h-4 w-4 text-amber-400" />
                Order Book
              </h3>
            </div>
            <div className="p-4">
              <OrderBook symbol={selectedSymbol} currentPrice={currentPrice} />
            </div>
          </div>
        </div>
      </div>
    </div>
      

      {/* Notification Container */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 md:inset-auto md:top-24 md:right-6 md:left-auto">
        {alerts.map((message) => (
          <BotNotification
            key={message.id}
            message={message}
            onClose={() => {
              dismissAlert(message.id);
            }}
          />
        ))}
      </div>
    </main>
  );
}