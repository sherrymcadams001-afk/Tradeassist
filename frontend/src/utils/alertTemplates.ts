import type { NotificationPriority } from "../types/notifications";

export type AlertCategory =
  | "Market Volatility"
  | "Execution Success"
  | "Risk Management"
  | "Technical Signals"
  | "Portfolio Events"
  | "Arbitrage Detection"
  | "News Events"
  | "User Actions";

export interface AlertConditions {
  volatility?: Array<"low" | "medium" | "high">;
  trend?: Array<"up" | "down" | "sideways">;
  pnlDirection?: Array<"positive" | "negative">;
  requiresExecution?: boolean;
  requiresRisk?: boolean;
  requiresPortfolioShift?: boolean;
  requiresNews?: boolean;
  requiresUserAction?: boolean;
  requiresArbitrage?: boolean;
}

export interface AlertTemplate {
  id: string;
  category: AlertCategory;
  template: string;
  icon: string;
  color: {
    from: string;
    to: string;
    border: string;
  };
  priority: NotificationPriority;
  conditions?: AlertConditions;
}

export const ALERT_TEMPLATES: AlertTemplate[] = [
  // Market Volatility (8)
  {
    id: "vol_001",
    category: "Market Volatility",
    template: "Volatility spike on {symbol}: {change}% swing over {window}m window.",
    icon: "🌪️",
    color: { from: "from-amber-500/30", to: "to-amber-700/10", border: "border-amber-400/60" },
    priority: "high",
    conditions: { volatility: ["high"] },
  },
  {
    id: "vol_002",
    category: "Market Volatility",
    template: "{symbol} just broke its {timeframe} ATR band. Expect whipsaws.",
    icon: "⚠️",
    color: { from: "from-orange-500/30", to: "to-orange-700/10", border: "border-orange-400/60" },
    priority: "high",
    conditions: { volatility: ["high"], trend: ["up", "down"] },
  },
  {
    id: "vol_003",
    category: "Market Volatility",
    template: "Session liquidity for {symbol} dropped {volume}% — spreads widening.",
    icon: "💧",
    color: { from: "from-cyan-500/20", to: "to-cyan-900/10", border: "border-cyan-400/50" },
    priority: "medium",
    conditions: { volatility: ["low", "medium"] },
  },
  {
    id: "vol_004",
    category: "Market Volatility",
    template: "Order book imbalance detected: {symbol} bids outweigh asks by {ratio}x.",
    icon: "⚖️",
    color: { from: "from-emerald-500/20", to: "to-emerald-900/10", border: "border-emerald-400/50" },
    priority: "medium",
    conditions: { volatility: ["medium", "high"] },
  },
  {
    id: "vol_005",
    category: "Market Volatility",
    template: "Circuit watch: {symbol} realized variance up {volatility}% over baseline.",
    icon: "📈",
    color: { from: "from-purple-500/20", to: "to-purple-900/10", border: "border-purple-400/50" },
    priority: "high",
    conditions: { volatility: ["high"] },
  },
  {
    id: "vol_006",
    category: "Market Volatility",
    template: "Calm regime: {symbol} intraday range compressed to {range}% — breakout setup.",
    icon: "🌊",
    color: { from: "from-blue-500/20", to: "to-blue-900/10", border: "border-blue-400/50" },
    priority: "low",
    conditions: { volatility: ["low"] },
  },
  {
    id: "vol_007",
    category: "Market Volatility",
    template: "Funding flip: {symbol} perp funding at {funding}% — positioning resetting.",
    icon: "🔄",
    color: { from: "from-fuchsia-500/20", to: "to-fuchsia-900/10", border: "border-fuchsia-400/50" },
    priority: "medium",
    conditions: { volatility: ["medium", "high"] },
  },
  {
    id: "vol_008",
    category: "Market Volatility",
    template: "Session hand-off: {session} traders pushing {symbol} {direction} with {volume}x volume.",
    icon: "🕒",
    color: { from: "from-slate-500/20", to: "to-slate-900/10", border: "border-slate-400/50" },
    priority: "medium",
    conditions: { volatility: ["medium"] },
  },

  // Execution Success (7)
  {
    id: "exe_001",
    category: "Execution Success",
    template: "Scalp fill confirmed: {symbol} entry at ${price} with {slippage} bps slippage.",
    icon: "✅",
    color: { from: "from-emerald-500/25", to: "to-emerald-900/5", border: "border-emerald-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_002",
    category: "Execution Success",
    template: "Target lock: {symbol} TP hit at ${target} (+{gain}%).",
    icon: "🎯",
    color: { from: "from-cyan-500/25", to: "to-cyan-900/5", border: "border-cyan-400/60" },
    priority: "high",
    conditions: { requiresExecution: true, trend: ["up"] },
  },
  {
    id: "exe_003",
    category: "Execution Success",
    template: "Layered order #{level} for {symbol} filled exactly at ${price}.",
    icon: "📌",
    color: { from: "from-indigo-500/25", to: "to-indigo-900/5", border: "border-indigo-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_004",
    category: "Execution Success",
    template: "Hedge order matched vs {hedgeSymbol} — spread locked at {spread} bps.",
    icon: "🛡️",
    color: { from: "from-sky-500/25", to: "to-sky-900/5", border: "border-sky-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_005",
    category: "Execution Success",
    template: "Trailing stop advanced: securing {pnl}% on {symbol} swing.",
    icon: "🪙",
    color: { from: "from-amber-500/25", to: "to-amber-900/5", border: "border-amber-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_006",
    category: "Execution Success",
    template: "Partial exit executed: released {size}% exposure while trend persists.",
    icon: "🧩",
    color: { from: "from-rose-500/25", to: "to-rose-900/5", border: "border-rose-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_007",
    category: "Execution Success",
    template: "Grid ladder refreshed for {symbol}; next liquidity pocket at ${nextLevel}.",
    icon: "📐",
    color: { from: "from-lime-500/25", to: "to-lime-900/5", border: "border-lime-400/60" },
    priority: "low",
    conditions: { requiresExecution: true },
  },
  {
    id: "exe_008",
    category: "Execution Success",
    template: "VWAP participation order completed at {participation}% of volume.",
    icon: "📊",
    color: { from: "from-blue-500/25", to: "to-blue-900/5", border: "border-blue-400/60" },
    priority: "medium",
    conditions: { requiresExecution: true },
  },

  // Risk Management (6)
  {
    id: "risk_001",
    category: "Risk Management",
    template: "Drawdown alert: equity down {drawdown}% vs daily limit {limit}%.",
    icon: "🚨",
    color: { from: "from-red-500/30", to: "to-red-900/10", border: "border-red-400/70" },
    priority: "high",
    conditions: { requiresRisk: true, pnlDirection: ["negative"] },
  },
  {
    id: "risk_002",
    category: "Risk Management",
    template: "Position heat: {symbol} now {exposure}% of book (cap {cap}%).",
    icon: "🔥",
    color: { from: "from-orange-500/25", to: "to-orange-900/10", border: "border-orange-400/60" },
    priority: "medium",
    conditions: { requiresRisk: true },
  },
  {
    id: "risk_003",
    category: "Risk Management",
    template: "Correlation cluster detected between {symbol} and {pairSymbol}.",
    icon: "🔗",
    color: { from: "from-slate-500/25", to: "to-slate-900/10", border: "border-slate-400/60" },
    priority: "medium",
    conditions: { requiresRisk: true },
  },
  {
    id: "risk_004",
    category: "Risk Management",
    template: "Margin buffer restored: utilization back to {utilization}%.",
    icon: "🧮",
    color: { from: "from-emerald-500/25", to: "to-emerald-900/10", border: "border-emerald-400/60" },
    priority: "low",
    conditions: { requiresRisk: true, pnlDirection: ["positive"] },
  },
  {
    id: "risk_005",
    category: "Risk Management",
    template: "Stop cluster synced to ${stopPrice} on {symbol}.",
    icon: "🛑",
    color: { from: "from-rose-500/25", to: "to-rose-900/10", border: "border-rose-400/60" },
    priority: "medium",
    conditions: { requiresRisk: true },
  },
  {
    id: "risk_006",
    category: "Risk Management",
    template: "Vol targeting trimmed leverage to {leverage}x for {symbol}.",
    icon: "📉",
    color: { from: "from-violet-500/25", to: "to-violet-900/10", border: "border-violet-400/60" },
    priority: "medium",
    conditions: { requiresRisk: true, volatility: ["high"] },
  },
  {
    id: "risk_007",
    category: "Risk Management",
    template: "Scenario stress run complete — worst case loss {stressLoss}%.",
    icon: "🧪",
    color: { from: "from-indigo-500/25", to: "to-indigo-900/10", border: "border-indigo-400/60" },
    priority: "medium",
    conditions: { requiresRisk: true },
  },

  // Technical Signals (7)
  {
    id: "tech_001",
    category: "Technical Signals",
    template: "RSI divergence confirmed on {symbol} ({timeframe} TF).",
    icon: "📊",
    color: { from: "from-purple-500/25", to: "to-purple-900/5", border: "border-purple-400/60" },
    priority: "medium",
    conditions: { trend: ["up", "down"] },
  },
  {
    id: "tech_002",
    category: "Technical Signals",
    template: "EMA ribbon flip: {symbol} fast EMA crossing slow.",
    icon: "🔁",
    color: { from: "from-indigo-500/25", to: "to-indigo-900/5", border: "border-indigo-400/60" },
    priority: "medium",
    conditions: { trend: ["up", "down"] },
  },
  {
    id: "tech_003",
    category: "Technical Signals",
    template: "Volume climax on {symbol}: {volume}x average.",
    icon: "📡",
    color: { from: "from-amber-500/25", to: "to-amber-900/5", border: "border-amber-400/60" },
    priority: "high",
    conditions: { volatility: ["high"] },
  },
  {
    id: "tech_004",
    category: "Technical Signals",
    template: "Bollinger squeeze firing — {symbol} poised for range expansion.",
    icon: "🧨",
    color: { from: "from-pink-500/25", to: "to-pink-900/5", border: "border-pink-400/60" },
    priority: "medium",
    conditions: { volatility: ["low"] },
  },
  {
    id: "tech_005",
    category: "Technical Signals",
    template: "Fib confluence: {symbol} respecting {level}% retracement.",
    icon: "📐",
    color: { from: "from-teal-500/25", to: "to-teal-900/5", border: "border-teal-400/60" },
    priority: "low",
    conditions: { trend: ["up", "down"] },
  },
  {
    id: "tech_006",
    category: "Technical Signals",
    template: "VWAP reclaim on {symbol}; intraday bias flipped.",
    icon: "🧭",
    color: { from: "from-blue-500/25", to: "to-blue-900/5", border: "border-blue-400/60" },
    priority: "medium",
    conditions: { trend: ["up", "down"] },
  },
  {
    id: "tech_007",
    category: "Technical Signals",
    template: "OBV divergence indicates stealth accumulation on {symbol}.",
    icon: "📥",
    color: { from: "from-lime-500/25", to: "to-lime-900/5", border: "border-lime-400/60" },
    priority: "medium",
    conditions: { trend: ["up"] },
  },
  {
    id: "tech_008",
    category: "Technical Signals",
    template: "Keltner channel breach: {symbol} volatility expansion in play.",
    icon: "🛰️",
    color: { from: "from-teal-500/25", to: "to-teal-900/5", border: "border-teal-400/60" },
    priority: "medium",
    conditions: { volatility: ["medium", "high"] },
  },

  // Portfolio Events (6)
  {
    id: "port_001",
    category: "Portfolio Events",
    template: "Daily PnL now {pnlSign}{pnlAmount} USDT ({pnlPercent}%).",
    icon: "💼",
    color: { from: "from-emerald-500/25", to: "to-emerald-900/5", border: "border-emerald-400/60" },
    priority: "medium",
    conditions: { requiresPortfolioShift: true },
  },
  {
    id: "port_002",
    category: "Portfolio Events",
    template: "Rotating {rotation}% capital from {fromSymbol} into {toSymbol}.",
    icon: "🔄",
    color: { from: "from-cyan-500/25", to: "to-cyan-900/5", border: "border-cyan-400/60" },
    priority: "medium",
    conditions: { requiresPortfolioShift: true },
  },
  {
    id: "port_003",
    category: "Portfolio Events",
    template: "Cash buffer adjusted to {cashBuffer}% post volatility review.",
    icon: "💰",
    color: { from: "from-yellow-500/25", to: "to-yellow-900/5", border: "border-yellow-400/60" },
    priority: "low",
    conditions: { requiresPortfolioShift: true },
  },
  {
    id: "port_004",
    category: "Portfolio Events",
    template: "Top performer: {symbol} contributing {weight}% of today's gains.",
    icon: "🏅",
    color: { from: "from-orange-500/25", to: "to-orange-900/5", border: "border-orange-400/60" },
    priority: "medium",
    conditions: { pnlDirection: ["positive"], requiresPortfolioShift: true },
  },
  {
    id: "port_005",
    category: "Portfolio Events",
    template: "Underperformer flagged: {symbol} lagging benchmark by {lag}%.",
    icon: "📉",
    color: { from: "from-rose-500/25", to: "to-rose-900/5", border: "border-rose-400/60" },
    priority: "medium",
    conditions: { pnlDirection: ["negative"], requiresPortfolioShift: true },
  },
  {
    id: "port_006",
    category: "Portfolio Events",
    template: "Beta adjusted to {beta} after regime check.",
    icon: "🧮",
    color: { from: "from-slate-500/25", to: "to-slate-900/5", border: "border-slate-400/60" },
    priority: "low",
    conditions: { requiresPortfolioShift: true },
  },
  {
    id: "port_007",
    category: "Portfolio Events",
    template: "Rebalance window triggered — redistributing across {sectorCount} sectors.",
    icon: "⚙️",
    color: { from: "from-gray-500/25", to: "to-gray-900/5", border: "border-gray-400/60" },
    priority: "medium",
    conditions: { requiresPortfolioShift: true },
  },

  // Arbitrage Detection (5)
  {
    id: "arb_001",
    category: "Arbitrage Detection",
    template: "Spread alert: {symbol} vs {arbPair} diverged {spread} bps.",
    icon: "🔍",
    color: { from: "from-green-500/25", to: "to-green-900/5", border: "border-green-400/60" },
    priority: "high",
    conditions: { requiresArbitrage: true },
  },
  {
    id: "arb_002",
    category: "Arbitrage Detection",
    template: "Latency edge: books show {symbol} premium of {premium} USDT on alternative venue.",
    icon: "⚡",
    color: { from: "from-yellow-500/25", to: "to-yellow-900/5", border: "border-yellow-400/60" },
    priority: "high",
    conditions: { requiresArbitrage: true },
  },
  {
    id: "arb_003",
    category: "Arbitrage Detection",
    template: "Stat arb signal: z-score {zscore} for {symbol}/{arbPair} pair.",
    icon: "📏",
    color: { from: "from-blue-500/25", to: "to-blue-900/5", border: "border-blue-400/60" },
    priority: "medium",
    conditions: { requiresArbitrage: true },
  },
  {
    id: "arb_004",
    category: "Arbitrage Detection",
    template: "Triangular window open: {triangle} mismatch worth {triEdge} bps.",
    icon: "🔺",
    color: { from: "from-fuchsia-500/25", to: "to-fuchsia-900/5", border: "border-fuchsia-400/60" },
    priority: "high",
    conditions: { requiresArbitrage: true },
  },
  {
    id: "arb_005",
    category: "Arbitrage Detection",
    template: "Carry trade refresh: funding differential {carry}% now positive.",
    icon: "💱",
    color: { from: "from-indigo-500/25", to: "to-indigo-900/5", border: "border-indigo-400/60" },
    priority: "medium",
    conditions: { requiresArbitrage: true },
  },
  {
    id: "arb_006",
    category: "Arbitrage Detection",
    template: "Cross-venue borrow unlocked: synthetic short edge worth {borrowEdge}%.",
    icon: "🏦",
    color: { from: "from-stone-500/25", to: "to-stone-900/5", border: "border-stone-400/60" },
    priority: "medium",
    conditions: { requiresArbitrage: true },
  },

  // News Events (5)
  {
    id: "news_001",
    category: "News Events",
    template: "Breaking: {newsSource} reports regulatory update impacting {symbol} sector.",
    icon: "📰",
    color: { from: "from-sky-500/25", to: "to-sky-900/5", border: "border-sky-400/60" },
    priority: "high",
    conditions: { requiresNews: true },
  },
  {
    id: "news_002",
    category: "News Events",
    template: "Macro release in {window}m: {eventName}. Adjusting exposure.",
    icon: "📅",
    color: { from: "from-amber-500/25", to: "to-amber-900/5", border: "border-amber-400/60" },
    priority: "medium",
    conditions: { requiresNews: true },
  },
  {
    id: "news_003",
    category: "News Events",
    template: "On-chain alert: {symbol} whale transfer {size} to exchange.",
    icon: "🐋",
    color: { from: "from-emerald-500/25", to: "to-emerald-900/5", border: "border-emerald-400/60" },
    priority: "high",
    conditions: { requiresNews: true },
  },
  {
    id: "news_004",
    category: "News Events",
    template: "Earnings season note: correlated equity {equitySymbol} beats estimates.",
    icon: "💹",
    color: { from: "from-purple-500/25", to: "to-purple-900/5", border: "border-purple-400/60" },
    priority: "medium",
    conditions: { requiresNews: true },
  },
  {
    id: "news_005",
    category: "News Events",
    template: "Sentiment shift: social volume for {symbol} up {sentiment}% in last hour.",
    icon: "💬",
    color: { from: "from-pink-500/25", to: "to-pink-900/5", border: "border-pink-400/60" },
    priority: "medium",
    conditions: { requiresNews: true },
  },
  {
    id: "news_006",
    category: "News Events",
    template: "Protocol upgrade scheduled: {symbol} fork countdown at {window} mins.",
    icon: "🛠️",
    color: { from: "from-gray-500/25", to: "to-gray-900/5", border: "border-gray-400/60" },
    priority: "high",
    conditions: { requiresNews: true },
  },

  // User Actions (6)
  {
    id: "user_001",
    category: "User Actions",
    template: "Manual override accepted: {userAction} applied to {symbol}.",
    icon: "🖐️",
    color: { from: "from-violet-500/25", to: "to-violet-900/5", border: "border-violet-400/60" },
    priority: "medium",
    conditions: { requiresUserAction: true },
  },
  {
    id: "user_002",
    category: "User Actions",
    template: "New strategy preset loaded: {presetName} across tracked pairs.",
    icon: "🧠",
    color: { from: "from-indigo-500/25", to: "to-indigo-900/5", border: "border-indigo-400/60" },
    priority: "medium",
    conditions: { requiresUserAction: true },
  },
  {
    id: "user_003",
    category: "User Actions",
    template: "Alert snoozed for {window}m per operator request.",
    icon: "😴",
    color: { from: "from-slate-500/25", to: "to-slate-900/5", border: "border-slate-400/60" },
    priority: "low",
    conditions: { requiresUserAction: true },
  },
  {
    id: "user_004",
    category: "User Actions",
    template: "Custom watchlist updated — {symbol} now high priority.",
    icon: "⭐",
    color: { from: "from-yellow-500/25", to: "to-yellow-900/5", border: "border-yellow-400/60" },
    priority: "low",
    conditions: { requiresUserAction: true },
  },
  {
    id: "user_005",
    category: "User Actions",
    template: "Session note recorded: \"{note}\".",
    icon: "📝",
    color: { from: "from-rose-500/25", to: "to-rose-900/5", border: "border-rose-400/60" },
    priority: "low",
    conditions: { requiresUserAction: true },
  },
  {
    id: "user_006",
    category: "User Actions",
    template: "Alert routing changed to {channel} channel per operator.",
    icon: "📨",
    color: { from: "from-cyan-500/25", to: "to-cyan-900/5", border: "border-cyan-400/60" },
    priority: "low",
    conditions: { requiresUserAction: true },
  },
];

export const ALERT_TEMPLATE_COUNT = ALERT_TEMPLATES.length;
