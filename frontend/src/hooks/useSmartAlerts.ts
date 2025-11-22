import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NotificationItem, NotificationPriority } from "../types/notifications";
import type { MarketCondition } from "./useBotSimulation";
import type { TickerData } from "./useBinanceTicker";
import { ALERT_TEMPLATES, type AlertTemplate, type AlertCategory } from "../utils/alertTemplates";
import { getTimeOfDaySlot, randomBetween, randomIntBetween } from "../utils/simulationTiming";

const REPEAT_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const MAX_ALERTS = 3;

type CategoryEventKey =
  | "executionEvent"
  | "riskEvent"
  | "portfolioEvent"
  | "newsEvent"
  | "userEvent"
  | "arbitrageEvent";

const CATEGORY_CONTEXT_REQUIREMENTS: Partial<Record<AlertCategory, CategoryEventKey>> = {
  "Execution Success": "executionEvent",
  "Risk Management": "riskEvent",
  "Portfolio Events": "portfolioEvent",
  "News Events": "newsEvent",
  "User Actions": "userEvent",
  "Arbitrage Detection": "arbitrageEvent",
};

type IntervalWindowConfig = {
  probability: number;
  lengthRange: [number, number];
  multiplierRange: [number, number];
};

export interface AlertTimingConfig {
  baseInterval: number;
  variance: number;
  minInterval: number;
  maxConsistentIntervals: number;
  burst: IntervalWindowConfig;
  calm: IntervalWindowConfig;
  timeOfDayMultipliers: Record<ReturnType<typeof getTimeOfDaySlot>, number>;
  volatilityMultipliers: {
    high: number;
    low: number;
  };
  trendMultipliers: {
    trending: number;
    sideways: number;
  };
  eventAccelerators: {
    execution: number;
    risk: number;
    portfolio: number;
    news: number;
    user: number;
    arbitrage: number;
  };
  priorityOffsets: Record<NotificationPriority, number>;
}

const DEFAULT_ALERT_TIMING: AlertTimingConfig = {
  baseInterval: 32000,
  variance: 0.25,
  minInterval: 6000,
  maxConsistentIntervals: 3,
  burst: {
    probability: 0.12,
    lengthRange: [2, 3],
    multiplierRange: [0.25, 0.6],
  },
  calm: {
    probability: 0.25,
    lengthRange: [2, 3],
    multiplierRange: [1.8, 2.6],
  },
  timeOfDayMultipliers: {
    morning: 1.05,
    midday: 1.15,
    evening: 1.3,
    night: 1.4,
  },
  volatilityMultipliers: {
    high: 0.85,
    low: 1.35,
  },
  trendMultipliers: {
    trending: 0.95,
    sideways: 1.15,
  },
  eventAccelerators: {
    execution: 0.9,
    risk: 0.7,
    portfolio: 0.95,
    news: 0.85,
    user: 1,
    arbitrage: 0.9,
  },
  priorityOffsets: {
    high: 0.85,
    medium: 1,
    low: 1.3,
  },
};

interface SimulationFlags {
  execution: boolean;
  risk: boolean;
  portfolio: boolean;
  news: boolean;
  user: boolean;
  arbitrage: boolean;
}

interface AlertContext {
  volatility: MarketCondition["volatility"];
  trend: MarketCondition["trend"];
  pnlDirection: "positive" | "negative";
  executionEvent: boolean;
  riskEvent: boolean;
  portfolioEvent: boolean;
  newsEvent: boolean;
  userEvent: boolean;
  arbitrageEvent: boolean;
}

interface UseSmartAlertsProps {
  symbols: string[];
  selectedSymbol?: string;
  marketCondition: MarketCondition;
  pnl: number;
  allocationLimit: number;
  tickers: Record<string, TickerData>;
  enabled?: boolean;
  timingConfig?: Partial<AlertTimingConfig>;
}

interface UseSmartAlertsReturn {
  alerts: NotificationItem[];
  dismissAlert: (id: string) => void;
  triggerImmediateAlert: () => void;
}

const DEFAULT_SYMBOL = "BTC/USDT";

const pickRandom = <T,>(items: T[], fallback: T) => (items.length ? items[Math.floor(Math.random() * items.length)] : fallback);

const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

const resolvePlaceholderValue = (
  key: string,
  template: AlertTemplate,
  placeholders: Record<string, string>
) => {
  if (key === "size") {
    if (template.id === "exe_006") {
      return placeholders.sizePercent;
    }
    if (template.id === "news_003") {
      return placeholders.sizeWhale;
    }
  }
  if (key === "volume" && template.id === "vol_003") {
    return placeholders.volumePercent;
  }
  return placeholders[key] ?? placeholders.symbol ?? DEFAULT_SYMBOL;
};

export function useSmartAlerts({
  symbols,
  selectedSymbol,
  marketCondition,
  pnl,
  allocationLimit,
  tickers,
  enabled = true,
  timingConfig,
}: UseSmartAlertsProps): UseSmartAlertsReturn {
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [flags, setFlags] = useState<SimulationFlags>({
    execution: false,
    risk: false,
    portfolio: false,
    news: false,
    user: false,
    arbitrage: false,
  });

  const lastTemplateUsageRef = useRef<Map<string, number>>(new Map());
  const alertTimeoutRef = useRef<number | null>(null);
  const burstStateRef = useRef<{ remaining: number }>({ remaining: 0 });
  const calmStateRef = useRef<{ remaining: number }>({ remaining: 0 });
  const intervalHistoryRef = useRef<number[]>([]);
  const computeIntervalRef = useRef<() => number>(() => DEFAULT_ALERT_TIMING.baseInterval);
  const lastPriorityRef = useRef<NotificationPriority>("medium");

  const resolvedTiming = useMemo<AlertTimingConfig>(() => ({
    ...DEFAULT_ALERT_TIMING,
    ...timingConfig,
    burst: {
      ...DEFAULT_ALERT_TIMING.burst,
      ...timingConfig?.burst,
    },
    calm: {
      ...DEFAULT_ALERT_TIMING.calm,
      ...timingConfig?.calm,
    },
    timeOfDayMultipliers: {
      ...DEFAULT_ALERT_TIMING.timeOfDayMultipliers,
      ...timingConfig?.timeOfDayMultipliers,
    },
    volatilityMultipliers: {
      ...DEFAULT_ALERT_TIMING.volatilityMultipliers,
      ...timingConfig?.volatilityMultipliers,
    },
    trendMultipliers: {
      ...DEFAULT_ALERT_TIMING.trendMultipliers,
      ...timingConfig?.trendMultipliers,
    },
    eventAccelerators: {
      ...DEFAULT_ALERT_TIMING.eventAccelerators,
      ...timingConfig?.eventAccelerators,
    },
    priorityOffsets: {
      ...DEFAULT_ALERT_TIMING.priorityOffsets,
      ...timingConfig?.priorityOffsets,
    },
  }), [timingConfig]);

  const normalizedSymbol = useMemo(() => {
    if (selectedSymbol && symbols.includes(selectedSymbol)) {
      return selectedSymbol;
    }
    return symbols[0] ?? DEFAULT_SYMBOL;
  }, [selectedSymbol, symbols]);

  const comparisonSymbol = useMemo(() => {
    const alternate = symbols.find((sym) => sym !== normalizedSymbol);
    return alternate ?? normalizedSymbol;
  }, [symbols, normalizedSymbol]);

  const selectedTicker = tickers[normalizedSymbol];
  const comparisonTicker = tickers[comparisonSymbol];
  const pnlPercent = allocationLimit > 0 ? (pnl / allocationLimit) * 100 : 0;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const updateFlags = () => {
      const changeMagnitude = Math.abs(selectedTicker?.change24h ?? 0);
      const comparisonChange = Math.abs(comparisonTicker?.change24h ?? 0);

      setFlags({
        execution: changeMagnitude > 0.8 || Math.random() > 0.55,
        risk: pnlPercent <= -1 || marketCondition.volatility === "high" || Math.random() > 0.82,
        portfolio: Math.abs(pnlPercent) >= 0.7 || Math.random() > 0.68,
        news: Math.random() > 0.83,
        user: Math.random() > 0.9,
        arbitrage: changeMagnitude - comparisonChange > 1.5 || Math.random() > 0.85,
      });
    };

    updateFlags();
    const cadence = 15_000 + Math.random() * 15_000;
    const intervalId = window.setInterval(updateFlags, cadence);
    return () => window.clearInterval(intervalId);
  }, [
    enabled,
    selectedTicker?.change24h,
    comparisonTicker?.change24h,
    pnlPercent,
    marketCondition.volatility,
  ]);

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      lastTemplateUsageRef.current.clear();
    }
  }, [enabled]);

  const alertContext = useMemo<AlertContext>(() => {
    const changeMagnitude = Math.abs(selectedTicker?.change24h ?? 0);
    const comparisonChange = Math.abs(comparisonTicker?.change24h ?? 0);

    return {
      volatility: marketCondition.volatility,
      trend: marketCondition.trend,
      pnlDirection: pnl >= 0 ? "positive" : "negative",
      executionEvent: flags.execution || changeMagnitude > 1.2,
      riskEvent: flags.risk || pnlPercent <= -1.5,
      portfolioEvent: flags.portfolio || Math.abs(pnlPercent) >= 0.9,
      newsEvent: flags.news,
      userEvent: flags.user,
      arbitrageEvent: flags.arbitrage || Math.abs(changeMagnitude - comparisonChange) > 1.8,
    };
  }, [
    flags,
    marketCondition.trend,
    marketCondition.volatility,
    pnl,
    pnlPercent,
    selectedTicker?.change24h,
    comparisonTicker?.change24h,
  ]);

  const matchesConditions = useCallback(
    (template: AlertTemplate) => {
      const conditions = template.conditions;
      if (conditions) {
        if (conditions.volatility && !conditions.volatility.includes(alertContext.volatility)) {
          return false;
        }
        if (conditions.trend && !conditions.trend.includes(alertContext.trend)) {
          return false;
        }
        if (conditions.pnlDirection && !conditions.pnlDirection.includes(alertContext.pnlDirection)) {
          return false;
        }
        if (conditions.requiresExecution && !alertContext.executionEvent) {
          return false;
        }
        if (conditions.requiresRisk && !alertContext.riskEvent) {
          return false;
        }
        if (conditions.requiresPortfolioShift && !alertContext.portfolioEvent) {
          return false;
        }
        if (conditions.requiresNews && !alertContext.newsEvent) {
          return false;
        }
        if (conditions.requiresUserAction && !alertContext.userEvent) {
          return false;
        }
        if (conditions.requiresArbitrage && !alertContext.arbitrageEvent) {
          return false;
        }
      }

      const categoryRequirement = CATEGORY_CONTEXT_REQUIREMENTS[template.category];
      if (categoryRequirement && !alertContext[categoryRequirement]) {
        return false;
      }

      return true;
    },
    [alertContext]
  );

  const buildPlaceholderValues = useCallback(() => {
    const fallbackPrice = selectedTicker?.price ?? randomBetween(20_000, 40_000);
    const altPrice = comparisonTicker?.price ?? fallbackPrice * (0.97 + Math.random() * 0.06);
    const windowMinutes = randomIntBetween(5, 90);
    const session = pickRandom(["Asia", "Europe", "US"], "Asia");
    const direction =
      marketCondition.trend === "up" ? "higher" : marketCondition.trend === "down" ? "lower" : "sideways";

    return {
      symbol: normalizedSymbol,
      change: formatNumber(selectedTicker?.change24h ?? randomBetween(-4, 4), 2),
      window: windowMinutes.toString(),
      timeframe: pickRandom(["1m", "5m", "15m", "1h", "4h"], "15m"),
      volume: formatNumber(randomBetween(2, 8), 1),
      volumePercent: formatNumber(randomBetween(5, 20), 1),
      ratio: formatNumber(randomBetween(1.1, 3.5), 2),
      volatility: formatNumber(randomBetween(20, 80), 1),
      range: formatNumber(randomBetween(0.3, 2.2), 2),
      session,
      direction,
      funding: formatNumber(randomBetween(-0.12, 0.18), 3),
      price: formatNumber(fallbackPrice, 2),
      slippage: formatNumber(randomBetween(0.05, 1.2), 2),
      target: formatNumber(fallbackPrice * (1 + randomBetween(0.005, 0.03)), 2),
      gain: formatNumber(randomBetween(1, 6), 2),
      level: pickRandom(["1", "2", "3", "4", "5", "38.2", "50", "61.8"], "1"),
      hedgeSymbol: comparisonSymbol,
      spread: formatNumber(randomBetween(0.05, 0.5), 2),
      pnl: formatNumber(Math.abs(pnlPercent), 2),
      sizePercent: formatNumber(randomBetween(5, 40), 1),
      sizeWhale: `${randomIntBetween(200, 1500)} BTC`,
      size: formatNumber(randomBetween(5, 40), 1),
      nextLevel: formatNumber(fallbackPrice * (1 + randomBetween(0.002, 0.02)), 2),
      participation: formatNumber(randomBetween(25, 85), 0),
      drawdown: formatNumber(Math.abs(pnlPercent) || randomBetween(0.5, 3), 2),
      limit: formatNumber(randomBetween(1.5, 3.5), 1),
      exposure: formatNumber(randomBetween(15, 55), 1),
      cap: formatNumber(randomBetween(20, 60), 1),
      pairSymbol: comparisonSymbol,
      utilization: formatNumber(randomBetween(35, 75), 0),
      stopPrice: formatNumber(fallbackPrice * 0.98, 2),
      leverage: formatNumber(randomBetween(1.5, 4.5), 1),
      stressLoss: formatNumber(randomBetween(1, 6), 1),
      pnlSign: pnl >= 0 ? "+" : "-",
      pnlAmount: formatNumber(Math.abs(pnl), 2),
      pnlPercent: formatNumber(pnlPercent, 2),
      rotation: formatNumber(randomBetween(5, 25), 1),
      fromSymbol: comparisonSymbol,
      toSymbol: normalizedSymbol,
      cashBuffer: formatNumber(randomBetween(8, 25), 1),
      weight: formatNumber(randomBetween(10, 45), 1),
      lag: formatNumber(randomBetween(1, 6), 1),
      beta: formatNumber(randomBetween(0.7, 1.3), 2),
      sectorCount: randomIntBetween(3, 8).toString(),
      arbPair: comparisonSymbol,
      premium: formatNumber(randomBetween(5, 25), 2),
      zscore: formatNumber(randomBetween(-2, 2), 2),
      triangle: `${normalizedSymbol.split("/")[0]}-${comparisonSymbol.split("/")[0]}-USDT`,
      triEdge: formatNumber(randomBetween(0.1, 0.7), 2),
      carry: formatNumber(randomBetween(0.3, 2.3), 2),
      borrowEdge: formatNumber(randomBetween(0.2, 1.4), 2),
      newsSource: pickRandom(["CoinDesk", "Bloomberg", "Messari", "The Block"], "CoinDesk"),
      eventName: pickRandom(["CPI Print", "Jobs Data", "FOMC Presser", "ETF Filing"], "CPI Print"),
      sizeEvent: `${Math.floor(randomBetween(1, 5))}B`,
      equitySymbol: pickRandom(["NVDA", "TSLA", "META", "COIN"], "NVDA"),
      sentiment: formatNumber(randomBetween(20, 90), 0),
      userAction: pickRandom(["manual override", "risk trim", "exposure boost"], "manual override"),
      presetName: pickRandom(["Pulse-X", "Atlas", "Rainmaker"], "Pulse-X"),
      note: pickRandom(
        [
          "Focus on BTC dominance",
          "Pause during macro release",
          "Tighten stops into close",
        ],
        "Focus on BTC dominance"
      ),
      channel: pickRandom(["ops-bridge", "pager", "sms"], "ops-bridge"),
      sessionLabel: session,
      directionBias: direction,
      newsDelay: windowMinutes.toString(),
    };
  }, [
    comparisonSymbol,
    comparisonTicker?.price,
    marketCondition.trend,
    normalizedSymbol,
    pnl,
    pnlPercent,
    selectedTicker?.change24h,
    selectedTicker?.price,
  ]);

  const fillTemplate = useCallback(
    (template: AlertTemplate) => {
      const placeholders = buildPlaceholderValues();
      return template.template.replace(/\{(\w+)\}/g, (_, key: string) =>
        resolvePlaceholderValue(key, template, placeholders)
      );
    },
    [buildPlaceholderValues]
  );

  const generateAlert = useCallback((): NotificationItem | null => {
    const now = Date.now();
    const eligible = ALERT_TEMPLATES.filter((template) => {
      const lastUsed = lastTemplateUsageRef.current.get(template.id);
      if (lastUsed && now - lastUsed < REPEAT_WINDOW_MS) {
        return false;
      }
      return matchesConditions(template);
    });

    if (eligible.length === 0) {
      lastTemplateUsageRef.current.clear();
      return null;
    }

    const weighted = eligible.flatMap((template) => {
      const weight = template.priority === "high" ? 3 : template.priority === "medium" ? 2 : 1;
      return Array.from({ length: weight }, () => template);
    });

    const template = pickRandom(weighted, eligible[0]);
    const body = fillTemplate(template);

    const notification: NotificationItem = {
      id: `${template.id}_${now}`,
      title: template.category,
      body,
      category: template.category,
      icon: template.icon,
      color: template.color,
      priority: template.priority,
      timestamp: new Date(),
      symbol: normalizedSymbol,
    };

    lastTemplateUsageRef.current.set(template.id, now);
    lastPriorityRef.current = notification.priority;
    return notification;
  }, [fillTemplate, matchesConditions, normalizedSymbol]);

  const computeNextInterval = useCallback(() => {
    const varianceFactor =
      1 - resolvedTiming.variance + Math.random() * (resolvedTiming.variance * 2);
    const timeOfDayMultiplier =
      resolvedTiming.timeOfDayMultipliers[getTimeOfDaySlot()] ?? 1;

    let interval = resolvedTiming.baseInterval * varianceFactor * timeOfDayMultiplier;

    if (alertContext.volatility === "high") {
      interval *= resolvedTiming.volatilityMultipliers.high;
    } else if (alertContext.volatility === "low") {
      interval *= resolvedTiming.volatilityMultipliers.low;
    }

    if (alertContext.trend === "sideways") {
      interval *= resolvedTiming.trendMultipliers.sideways;
    } else {
      interval *= resolvedTiming.trendMultipliers.trending;
    }

    const applyEventMultiplier = (active: boolean, multiplier: number) => {
      if (active) {
        interval *= multiplier;
      }
    };

    applyEventMultiplier(alertContext.executionEvent, resolvedTiming.eventAccelerators.execution);
    applyEventMultiplier(alertContext.riskEvent, resolvedTiming.eventAccelerators.risk);
    applyEventMultiplier(alertContext.portfolioEvent, resolvedTiming.eventAccelerators.portfolio);
    applyEventMultiplier(alertContext.newsEvent, resolvedTiming.eventAccelerators.news);
    applyEventMultiplier(alertContext.userEvent, resolvedTiming.eventAccelerators.user);
    applyEventMultiplier(alertContext.arbitrageEvent, resolvedTiming.eventAccelerators.arbitrage);

    interval *= resolvedTiming.priorityOffsets[lastPriorityRef.current];

    const applyWindowMultiplier = (
      stateRef: MutableRefObject<{ remaining: number }>,
      config: IntervalWindowConfig
    ) => {
      if (stateRef.current.remaining > 0) {
        stateRef.current.remaining -= 1;
        return randomBetween(config.multiplierRange[0], config.multiplierRange[1]);
      }

      if (Math.random() < config.probability) {
        const span = Math.max(1, randomIntBetween(config.lengthRange[0], config.lengthRange[1]));
        stateRef.current.remaining = span - 1;
        return randomBetween(config.multiplierRange[0], config.multiplierRange[1]);
      }

      return 1;
    };

    interval *= applyWindowMultiplier(burstStateRef, resolvedTiming.burst);
    interval *= applyWindowMultiplier(calmStateRef, resolvedTiming.calm);

    interval = Math.max(interval, resolvedTiming.minInterval);

    const history = intervalHistoryRef.current;
    if (history.length >= resolvedTiming.maxConsistentIntervals - 1) {
      const tolerance = resolvedTiming.baseInterval * 0.05;
      const consistent = history.every((value) => Math.abs(value - interval) <= tolerance);
      if (consistent) {
        interval *= 0.75 + Math.random() * 0.45;
      }
    }

    intervalHistoryRef.current = [
      ...history.slice(-(resolvedTiming.maxConsistentIntervals - 1)),
      interval,
    ];

    return interval;
  }, [alertContext, resolvedTiming]);

  useEffect(() => {
    computeIntervalRef.current = computeNextInterval;
  }, [computeNextInterval]);

  useEffect(() => {
    if (!enabled) {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;
    burstStateRef.current.remaining = 0;
    calmStateRef.current.remaining = 0;
    intervalHistoryRef.current = [];

    const emitAlert = () => {
      if (cancelled) return;
      const alert = generateAlert();
      if (!alert) return;
      setAlerts((prev) => {
        const updated = [...prev, alert];
        return updated.slice(-MAX_ALERTS);
      });
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = computeIntervalRef.current();
      alertTimeoutRef.current = window.setTimeout(() => {
        emitAlert();
        scheduleNext();
      }, delay);
    };

    const initialDelay = Math.max(6000, computeIntervalRef.current());
    alertTimeoutRef.current = window.setTimeout(() => {
      emitAlert();
      scheduleNext();
    }, initialDelay);

    return () => {
      cancelled = true;
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
    };
  }, [enabled, generateAlert, resolvedTiming]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const triggerImmediateAlert = useCallback(() => {
    const alert = generateAlert();
    if (!alert) return;
    setAlerts((prev) => {
      const updated = [...prev, alert];
      return updated.slice(-MAX_ALERTS);
    });
    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current);
    }
    const delay = computeIntervalRef.current();
    alertTimeoutRef.current = window.setTimeout(() => {
      const nextAlert = generateAlert();
      if (!nextAlert) {
        return;
      }
      setAlerts((prev) => {
        const updated = [...prev, nextAlert];
        return updated.slice(-MAX_ALERTS);
      });
    }, delay);
  }, [generateAlert]);

  return {
    alerts,
    dismissAlert,
    triggerImmediateAlert,
  };
}
