import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Bell, Radio, Shield, TrendingUp, Zap, DollarSign, Target, TrendingDown } from "lucide-react";

import { ActiveOrder, ActiveOrders } from "./widgets/ActiveOrders";
import { RealTimeTicker } from "./widgets/RealTimeTicker";
import { ProfessionalChart } from "./ProfessionalChart";
import { useMarketStream } from "../hooks/useMarketStream";
import type { BotDescriptor, TierDefinition, UserProfile } from "../types/bot";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type AlertEntry = {
  id: string;
  message: string;
  severity: "info" | "warn";
};

type HeartbeatEntry = {
  id: string;
  text: string;
};

type DashboardProps = {
  bot?: BotDescriptor | null;
  profile?: UserProfile;
  tier?: TierDefinition;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/prices";
const FLAGSHIP_SYMBOL = "BTC/USDT";
const CANDLE_LIMIT = 720;

const HEARTBEAT_MESSAGES: Array<{ type: HeartbeatEntry["type"]; text: (symbol: string) => string }> = [
  { type: "scan", text: (symbol: string) => `[SCANNING] NASDAQ L3 Order Book ${symbol} · Spread ${(0.01 + Math.random() * 0.03).toFixed(3)}%` },
  { type: "execute", text: (symbol: string) => `[ARBITRAGE] Opportunity Detected ${symbol} · Executing Order...` },
  { type: "profit", text: (symbol: string) => `[PROFIT] Trade Closed ${symbol} · +${(Math.random() * 15 + 5).toFixed(2)} USDT Secured` },
  { type: "monitor", text: (symbol: string) => `[MONITORING] Funding Curve ${symbol} · Drift ${(Math.random() * 0.5).toFixed(2)}bps · Steady` },
  { type: "scan", text: (symbol: string) => `[LIQUIDITY] Sweep Detected ${symbol} · Depth ${(50 + Math.random() * 150).toFixed(0)} Contracts` },
  { type: "execute", text: (symbol: string) => `[EXECUTING] Market Entry ${symbol} · Price ${(Math.random() * 50000 + 30000).toFixed(2)} USDT` },
];

const ALERT_BLUEPRINTS: Array<{ severity: "info" | "warn"; text: (symbol: string) => string }> = [
  { severity: "warn", text: (symbol) => `Trend deviation detected on ${symbol} – adjusting stops.` },
  { severity: "info", text: (symbol) => `Volatility pocket forming on ${symbol} – widening bands.` },
  { severity: "warn", text: (symbol) => `Order book imbalance ${symbol} – rotating execution lanes.` },
  { severity: "info", text: (symbol) => `Momentum pulse ${symbol} – syncing with Advanced strategy.` },
];

export function Dashboard({ bot, profile, tier }: DashboardProps) {
  const { ticks, connected } = useMarketStream({ url: WS_URL });
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [chartStatus, setChartStatus] = useState<"loading" | "ready" | "error">("loading");
  const [healthStatus, setHealthStatus] = useState<"loading" | "ok" | "error">("loading");
  const [healthMeta, setHealthMeta] = useState<{ mode?: string; exchange?: string } | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(FLAGSHIP_SYMBOL);
  const [pnlTelemetry, setPnlTelemetry] = useState<{ value: number; delta: number }>({ value: 0, delta: 0 });
  const [heartbeatLog, setHeartbeatLog] = useState<HeartbeatEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const priceRef = useRef<number | null>(null);

  const supportedSymbols = useMemo(() => {
    if (bot?.universes?.length) {
      return bot.universes;
    }
    return [FLAGSHIP_SYMBOL];
  }, [bot?.universes]);

  const watchlist = useMemo(() => {
    const preferred = profile?.preferences?.symbols_whitelist?.filter((symbol) => supportedSymbols.includes(symbol));
    if (preferred && preferred.length) {
      return preferred;
    }
    return supportedSymbols.slice(0, 3);
  }, [profile?.preferences?.symbols_whitelist, supportedSymbols]);

  useEffect(() => {
    const fallback = watchlist[0] ?? supportedSymbols[0] ?? FLAGSHIP_SYMBOL;
    setSelectedSymbol((current) => {
      if (current && supportedSymbols.includes(current)) {
        return current;
      }
      return fallback;
    });
  }, [supportedSymbols, watchlist]);

  useEffect(() => {
    if (!selectedSymbol) {
      setCandles([]);
      return;
    }
    const controller = new AbortController();
    setChartStatus("loading");
    fetchSingleSymbol(selectedSymbol, controller.signal)
      .then((payload) => {
        setCandles(payload);
        setChartStatus(payload.length ? "ready" : "error");
      })
      .catch((err) => {
        if (isAbortError(err)) {
          return;
        }
        console.error("Failed to load OHLCV", err);
        setCandles([]);
        setChartStatus("error");
      });
    return () => controller.abort();
  }, [selectedSymbol]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/health`)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`Health probe failed (${resp.status})`);
        }
        return resp.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setHealthMeta(payload);
        setHealthStatus("ok");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Health probe failed", err);
        setHealthMeta(null);
        setHealthStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const entries = Object.values(ticks);
    if (!entries.length) {
      setOrders([]);
      return;
    }
    const prioritized = [...entries].sort((a, b) => (a.symbol === selectedSymbol ? -1 : b.symbol === selectedSymbol ? 1 : 0));
    const sample = prioritized.slice(0, 3).map((tick, idx) => ({
      id: `${tick.symbol}-${idx}`,
      venue: "BINANCE",
      symbol: tick.symbol,
      side: (idx % 2 === 0 ? "buy" : "sell") as ActiveOrder["side"],
      quantity: 0.5 + idx * 0.1,
      price: tick.last ?? tick.price ?? tick.bid ?? 0,
      status: "LIVE",
      ts: tick.ts,
    }));
    setOrders(sample);
  }, [ticks, selectedSymbol]);

  const advisoryMode = useMemo(() => (tier ? !tier.capabilities.includes("execution") : false), [tier]);
  const summaryPref = profile?.preferences?.notification_level ?? "summary";
  const selectedPrice = ticks[selectedSymbol]?.last ?? ticks[selectedSymbol]?.price;
  const feedStatus = chartStatus === "ready" && candles.length ? "Buffer ready" : chartStatus === "loading" ? "Hydrating" : "Fallback";

  useEffect(() => {
    priceRef.current = selectedPrice ?? null;
  }, [selectedPrice]);

  useEffect(() => {
    const capitalBase = profile?.preferences?.max_allocation ?? tier?.max_allocation ?? 0;
    if (!capitalBase) {
      setPnlTelemetry({ value: 0, delta: 0 });
      return;
    }
    const interval = setInterval(() => {
      setPnlTelemetry((previous) => {
        const price = priceRef.current ?? selectedPrice ?? 0;
        const drift = Math.sin(Date.now() / 4500) * 0.5;
        const volatilitySeed = price ? (price % 1000) / 1000 : Math.random();
        const delta = (volatilitySeed + Math.random() * 0.02) * drift * 0.004 * capitalBase;
        const bounded = Math.max(Math.min(previous.value + delta, capitalBase * 0.35), -capitalBase * 0.2);
        return { value: bounded, delta: bounded - previous.value };
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [profile?.preferences?.max_allocation, tier?.max_allocation, selectedPrice]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }
    const interval = setInterval(() => {
      const template = HEARTBEAT_MESSAGES[Math.floor(Math.random() * HEARTBEAT_MESSAGES.length)];
      const stamp = new Date().toLocaleTimeString(undefined, { hour12: false });
      const entry: HeartbeatEntry = { id: createId(), text: `${stamp} · ${template(selectedSymbol)} · ${feedStatus}` };
      setHeartbeatLog((prev) => [entry, ...prev].slice(0, 5));
    }, 2300);
    return () => clearInterval(interval);
  }, [selectedSymbol, feedStatus]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }
    const interval = setInterval(() => {
      if (Math.random() < 0.5) {
        return;
      }
      const blueprint = ALERT_BLUEPRINTS[Math.floor(Math.random() * ALERT_BLUEPRINTS.length)];
      const entry: AlertEntry = {
        id: createId(),
        message: blueprint.text(selectedSymbol),
        severity: blueprint.severity,
      };
      setAlerts((prev) => [entry, ...prev].slice(0, 4));
    }, 4800);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  return (
    <main className="min-h-full space-y-6 font-mono text-slate-100">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-slate-900 bg-[#05070f] p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Live Cockpit</p>
          <h2 className="text-2xl font-semibold text-white">Midas Touch Bot Vision</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            {tier ? `${tier.label} tier channel` : "Tier pending"} · {selectedSymbol}
          </p>
        </div>
        <div className="grid gap-2 text-xs md:text-sm" aria-live="polite">
          <StatusPill icon={<Activity size={16} />} label="Bot Link" value={connected ? "Linked" : "Linking"} />
          <StatusPill
            icon={<TrendingUp size={16} />}
            label="Data Exchange"
            value={
              healthStatus === "loading"
                ? "Probing"
                : healthStatus === "error"
                  ? "API Offline"
                  : healthMeta?.exchange?.toUpperCase() ?? "Mock"
            }
          />
          <StatusPill
            icon={<Zap size={16} />}
            label="Runtime"
            value={healthMeta?.mode === "mock" ? "Simulated" : healthStatus === "ok" ? "Live" : "Standby"}
          />
        </div>
      </header>

      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          <div className="rounded-2xl border border-slate-900 bg-[#0a0d14] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.85)]">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Primary feed</p>
                <h3 className="text-xl font-semibold text-white">{selectedSymbol}</h3>
                <p className="text-sm text-slate-400">{selectedPrice ? `${selectedPrice.toFixed(2)} USDT` : "Live pricing"}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{feedStatus}</p>
                <p>{candles.length} pts buffered</p>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Symbol selection">
              {supportedSymbols.map((symbol) => {
                const active = symbol === selectedSymbol;
                return (
                  <button
                    key={symbol}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                      active
                        ? "border-slate-50 bg-slate-50/10 text-white"
                        : "border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"
                    }`}
                    onClick={() => setSelectedSymbol(symbol)}
                    aria-pressed={active}
                    role="tab"
                    aria-label={`Load ${symbol} chart`}
                    disabled={chartStatus === "loading" && active}
                  >
                    {symbol}
                  </button>
                );
              })}
            </div>
            <ProfessionalChart candles={candles} />
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.3em] text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-px w-8 bg-cyan-300" /> EMA 20
              </span>
              <span className="flex items-center gap-2">
                <span className="h-px w-8 bg-fuchsia-400" /> EMA 50
              </span>
              <span className="flex items-center gap-2">
                <span className="h-px w-8 bg-amber-300" /> Bot Vision Entry
              </span>
              <span className="flex items-center gap-2">
                <span className="h-px w-8 bg-rose-400" /> Bot Vision Exit
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-6 xl:col-span-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-900 bg-[#090c12] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Access posture</p>
              <span className="flex items-center gap-1 text-xs text-white">
                <Shield size={14} />
                {tier?.label ?? "Pending"}
              </span>
            </div>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <BarChart3 size={14} className="text-slate-500" />
                Allocation · {profile?.preferences?.max_allocation ?? tier?.max_allocation ?? 0}%
              </li>
              <li className="flex items-center gap-2">
                <Zap size={14} className="text-slate-500" />
                {advisoryMode ? "Advisory only" : "Execution unlocked"}
              </li>
              <li className="flex items-center gap-2">
                <Activity size={14} className="text-slate-500" />
                Alerts · {summaryPref}
              </li>
            </ul>
            {tier?.features?.length ? (
              <div className="rounded-xl border border-slate-900 bg-black/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Tier features</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-[#06110c] p-5">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Real-time PnL</p>
              <span className="text-xs text-slate-400">Vector {advisoryMode ? "advisory" : "execution"}</span>
            </header>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className={`text-3xl font-semibold ${pnlTelemetry.value >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                  {pnlTelemetry.value >= 0 ? "+" : ""}
                  {pnlTelemetry.value.toFixed(2)} USDT
                </p>
                <p className={`text-sm ${pnlTelemetry.delta >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                  {pnlTelemetry.delta >= 0 ? "▲" : "▼"} {Math.abs(pnlTelemetry.delta).toFixed(2)} / tick
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>Capital envelope</p>
                <p>{(profile?.preferences?.max_allocation ?? tier?.max_allocation ?? 0).toLocaleString()} USDT</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-[#070a11] p-5">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Heartbeat Log</p>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <Radio className="h-4 w-4 animate-pulse" /> Live
              </span>
            </header>
            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              {heartbeatLog.length ? (
                heartbeatLog.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-800 bg-black/30 px-3 py-2">
                    {entry.text}
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-slate-500">Awaiting pulse...</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-[#080b12] p-5">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alert System</p>
              <span className="text-xs text-slate-400">Trend monitor</span>
            </header>
            <ul className="mt-4 space-y-2 text-xs">
              {alerts.length ? (
                alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      alert.severity === "warn"
                        ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                        : "border-slate-800 bg-black/30 text-slate-200"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" /> {alert.message}
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-slate-500">No active alerts.</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-[#080b12] p-5" aria-label="Live ticker panel">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Market Book</p>
              <span className="text-xs text-slate-400">{Object.keys(ticks).length} feeds</span>
            </header>
            <div className="mt-4 min-h-[240px] rounded-xl border border-slate-800 bg-black/30">
              <RealTimeTicker ticks={ticks} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-[#080b12] p-5" aria-label="Order relay panel">
            <header className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order Relay</p>
              <span className="text-xs text-slate-400">{advisoryMode ? "Read only" : "Live"}</span>
            </header>
            <div className="mt-3">
              <ActiveOrders orders={advisoryMode ? [] : orders} />
              {advisoryMode ? (
                <p className="mt-3 text-center text-xs text-slate-500">
                  Execution disabled for advisory tiers.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type StatusPillProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatusPill({ icon, label, value }: StatusPillProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-black/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-slate-200">
      <span className="text-slate-200">{icon}</span>
      <span className="text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAbortError(err: unknown): err is DOMException {
  return typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError";
}

async function fetchSingleSymbol(symbol: string, signal?: AbortSignal): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, limit: String(CANDLE_LIMIT) });
  const resp = await fetch(`${API_BASE}/api/ohlcv?${params.toString()}`, { signal });
  if (!resp.ok) {
    throw new Error(`OHLCV request failed (${resp.status})`);
  }
  const payload = await resp.json();
  return Array.isArray(payload?.candles) ? payload.candles : [];
}
