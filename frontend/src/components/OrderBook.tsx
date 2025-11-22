import React from "react";

interface OrderBookProps {
  symbol: string;
  currentPrice: number;
}

interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
}

export default function OrderBook({ symbol, currentPrice }: OrderBookProps) {
  // Generate mock order book data based on current price
  const generateOrderBook = (): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } => {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    
    let bidTotal = 0;
    let askTotal = 0;

    // Generate 8 bid levels (below current price)
    for (let i = 0; i < 8; i++) {
      const price = currentPrice * (1 - (i + 1) * 0.0005);
      const amount = Math.random() * 2 + 0.5;
      bidTotal += amount;
      bids.push({ price, amount, total: bidTotal });
    }

    // Generate 8 ask levels (above current price)
    for (let i = 0; i < 8; i++) {
      const price = currentPrice * (1 + (i + 1) * 0.0005);
      const amount = Math.random() * 2 + 0.5;
      askTotal += amount;
      asks.unshift({ price, amount, total: askTotal });
    }

    return { bids, asks };
  };

  const { bids, asks } = generateOrderBook();
  const maxTotal = Math.max(
    bids[bids.length - 1]?.total || 0,
    asks[0]?.total || 0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 pb-2 mb-2 border-b border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider text-right">Price</div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider text-right">Amount</div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider text-right">Total</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Asks (Sell orders) - Red */}
        <div className="space-y-0.5 mb-2">
          {asks.map((ask, idx) => (
            <div key={`ask-${idx}`} className="relative grid grid-cols-3 gap-2 py-1 hover:bg-red-500/10 transition-colors">
              {/* Background bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-500/10"
                style={{ width: `${(ask.total / maxTotal) * 100}%` }}
              />
              <div className="relative text-[11px] text-red-400 font-mono text-right">
                {ask.price.toFixed(2)}
              </div>
              <div className="relative text-[11px] text-white/60 font-mono text-right">
                {ask.amount.toFixed(4)}
              </div>
              <div className="relative text-[11px] text-white/40 font-mono text-right">
                {ask.total.toFixed(4)}
              </div>
            </div>
          ))}
        </div>

        {/* Current Price */}
        <div className="my-3 py-2 px-3 bg-slate-800/50 rounded-lg border border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Last Price</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">{currentPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Bids (Buy orders) - Green */}
        <div className="space-y-0.5 mt-2">
          {bids.map((bid, idx) => (
            <div key={`bid-${idx}`} className="relative grid grid-cols-3 gap-2 py-1 hover:bg-green-500/10 transition-colors">
              {/* Background bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-green-500/10"
                style={{ width: `${(bid.total / maxTotal) * 100}%` }}
              />
              <div className="relative text-[11px] text-green-400 font-mono text-right">
                {bid.price.toFixed(2)}
              </div>
              <div className="relative text-[11px] text-white/60 font-mono text-right">
                {bid.amount.toFixed(4)}
              </div>
              <div className="relative text-[11px] text-white/40 font-mono text-right">
                {bid.total.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
