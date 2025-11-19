import { ReactNode, useEffect, useState } from "react";
import { Activity, TrendingUp, Zap } from "lucide-react";

import { ActiveOrder, ActiveOrders } from "./widgets/ActiveOrders";
import { RealTimeTicker } from "./widgets/RealTimeTicker";
import { ProfessionalChart } from "./ProfessionalChart";
import { useMarketStream } from "../hooks/useMarketStream";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/prices";

export function Dashboard() {
  const { ticks, connected } = useMarketStream({ url: WS_URL });
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/ohlcv/BTC/USDT?limit=720`)
      .then((resp) => resp.json())
      .then((payload) => setCandles(payload.candles))
      .catch((err) => console.error("Failed to hydrate candles", err));
  }, []);

  useEffect(() => {
    const entries = Object.values(ticks);
    if (!entries.length) {
      return;
    }
    const working = entries.slice(0, 3).map((tick, idx) => ({
      id: `${tick.symbol}-${idx}`,
      venue: "BINANCE",
      symbol: tick.symbol,
      side: idx % 2 === 0 ? "buy" : "sell",
      quantity: 0.5 + idx * 0.1,
      price: tick.last ?? tick.price ?? tick.bid ?? 0,
      status: "LIVE",
      ts: tick.ts,
    }));
    setOrders(working);
  }, [ticks]);

  return (
    <main className="min-h-screen bg-[#050505] text-slate-100 font-mono p-6 space-y-6">
      <header className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-slate-500">Module: VORTEX</p>
          <h1 className="text-3xl font-bold text-white">VERIDIAN Black-Box Terminal</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <StatusPill icon={<Activity size={16} />} label="Signal Mesh" value={connected ? "Linked" : "Linking"} />
          <StatusPill icon={<TrendingUp size={16} />} label="Data Sovereignty" value="CCXT/Binance" />
          <StatusPill icon={<Zap size={16} />} label="Cost Profile" value="$0 Runtime" />
        </div>
      </header>

      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          <div className="bg-[#0a0a0a] border border-slate-900 rounded-2xl p-4 shadow-[0_0_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between pb-4">
              <div>
                <h2 className="text-lg tracking-[0.2em] uppercase text-slate-400">Professional Chart</h2>
                <p className="text-slate-500 text-xs">Binance · BTC/USDT · EMA 20/50 overlay</p>
              </div>
              <span className="text-xs text-emerald-400">{candles.length ? "Historical buffer ready" : "Hydrating..."}</span>
            </div>
            <ProfessionalChart candles={candles} />
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          <div className="min-h-[320px]">
            <RealTimeTicker ticks={ticks} />
          </div>
          <div className="min-h-[220px]">
            <ActiveOrders orders={orders} />
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
    <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-black/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em]">
      <span className="text-emerald-400">{icon}</span>
      <span className="text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
