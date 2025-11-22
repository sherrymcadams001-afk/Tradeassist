import { MutableRefObject, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MESSAGE_TEMPLATES, MessageTemplate, BotMessage, type MessageCategory } from "../utils/botMessages";
import {
  getTimeOfDaySlot,
  randomBetween,
  randomIntBetween,
  type TimeOfDaySlot,
  getUtcSessionSlot,
  getSessionTempoFactor,
  pickRandomRegime,
  getRegimeDurationMs,
  getRegimeWinProfile,
  getRegimeTempoFactor,
} from "../utils/simulationTiming";
import type { MarketRegime, SessionSlot } from "../types/simulation";

export interface MarketCondition {
  volatility: "low" | "medium" | "high";
  trend: "up" | "down" | "sideways";
  volume: "low" | "normal" | "high";
}

interface IntervalWindowConfig {
  probability: number;
  lengthRange: [number, number];
  multiplierRange: [number, number];
}

export interface BotTimingConfig {
  baseInterval: number;
  variance: number;
  minInterval: number;
  maxConsistentIntervals: number;
  burst: IntervalWindowConfig;
  calm: IntervalWindowConfig;
  timeOfDayMultipliers: Record<TimeOfDaySlot, number>;
  marketMultipliers: {
    highVolatility: number;
    lowVolatility: number;
    trending: number;
    sideways: number;
  };
}

interface UseBotSimulationProps {
  symbols: string[];
  enabled?: boolean;
  messageInterval?: number; // milliseconds between messages
  timingConfig?: Partial<BotTimingConfig>;
}

const DEFAULT_BOT_TIMING: BotTimingConfig = {
  baseInterval: 12000,
  variance: 0.35,
  minInterval: 800,
  maxConsistentIntervals: 3,
  burst: {
    probability: 0.18,
    lengthRange: [2, 4],
    multiplierRange: [0.15, 0.45],
  },
  calm: {
    probability: 0.12,
    lengthRange: [2, 3],
    multiplierRange: [1.4, 2.2],
  },
  timeOfDayMultipliers: {
    morning: 0.9,
    midday: 1,
    evening: 1.1,
    night: 1.25,
  },
  marketMultipliers: {
    highVolatility: 0.65,
    lowVolatility: 1.2,
    trending: 0.85,
    sideways: 1.05,
  },
};

const REGIME_CATEGORY_WEIGHTS: Record<MarketRegime, Partial<Record<MessageCategory, number>>> = {
  bull: {
    trade_execution: 1.4,
    portfolio_actions: 1.2,
    advanced_signals: 1.15,
    risk_management: 0.85,
  },
  bear: {
    risk_management: 1.5,
    order_management: 1.2,
    portfolio_actions: 1.1,
    trade_execution: 0.8,
  },
  sideways: {
    technical_analysis: 1.3,
    market_scanning: 1.2,
    trade_execution: 0.9,
  },
  volatile: {
    advanced_signals: 1.35,
    risk_management: 1.25,
    order_management: 1.1,
  },
};

const SESSION_CATEGORY_WEIGHTS: Record<SessionSlot, Partial<Record<MessageCategory, number>>> = {
  asia_open: {
    market_scanning: 1.2,
    advanced_signals: 1.1,
  },
  asia_mid: {
    technical_analysis: 1.15,
    advanced_signals: 1.05,
  },
  europe_open: {
    technical_analysis: 1.2,
    risk_management: 1.1,
    trade_execution: 1.05,
  },
  us_open: {
    trade_execution: 1.3,
    order_management: 1.2,
  },
  us_power: {
    trade_execution: 1.35,
    portfolio_actions: 1.15,
  },
  overnight: {
    market_scanning: 1.25,
    risk_management: 1.2,
  },
};

const SESSION_LABELS: Record<SessionSlot, string> = {
  asia_open: "Asia Open",
  asia_mid: "Asia Mid",
  europe_open: "Europe Open",
  us_open: "US Open",
  us_power: "US Power Hour",
  overnight: "Overnight",
};

const OUTCOME_CATEGORIES: ReadonlyArray<MessageCategory> = [
  "trade_execution",
  "portfolio_actions",
  "risk_management",
  "advanced_signals",
];

interface UseBotSimulationReturn {
  messages: BotMessage[];
  isActive: boolean;
  marketCondition: MarketCondition;
  marketRegime: MarketRegime;
  session: SessionSlot;
  clearMessages: () => void;
}

/**
 * Intelligent bot simulation hook with temporal and market-aware message selection
 * Ensures no repeated templates within 10-15 minutes
 */
export function useBotSimulation({
  symbols,
  enabled = true,
  messageInterval = 12000, // Default: message every 12 seconds
  timingConfig,
}: UseBotSimulationProps): UseBotSimulationReturn {
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [marketCondition, setMarketCondition] = useState<MarketCondition>({
    volatility: "medium",
    trend: "sideways",
    volume: "normal",
  });
  const [sessionSlot, setSessionSlot] = useState<SessionSlot>(() => getUtcSessionSlot());
  const [marketRegime, setMarketRegime] = useState<MarketRegime>(() => pickRandomRegime());

  const recentTemplateIds = useRef<Set<string>>(new Set());
  const messageHistory = useRef<BotMessage[]>([]);
  const messageTimeoutRef = useRef<number | null>(null);
  const burstStateRef = useRef<{ remaining: number }>({ remaining: 0 });
  const calmStateRef = useRef<{ remaining: number }>({ remaining: 0 });
  const intervalHistoryRef = useRef<number[]>([]);
  const computeIntervalRef = useRef<() => number>(() => messageInterval);
  const hasSeededRef = useRef(false);
  const regimeExpiryRef = useRef<number>(Date.now() + getRegimeDurationMs());
  const regimeProfileRef = useRef(getRegimeWinProfile(marketRegime));

  const resolvedTiming = useMemo<BotTimingConfig>(() => {
    const baseInterval = timingConfig?.baseInterval ?? messageInterval;
    return {
      ...DEFAULT_BOT_TIMING,
      ...timingConfig,
      baseInterval,
      variance: timingConfig?.variance ?? DEFAULT_BOT_TIMING.variance,
      minInterval: timingConfig?.minInterval ?? DEFAULT_BOT_TIMING.minInterval,
      maxConsistentIntervals:
        timingConfig?.maxConsistentIntervals ?? DEFAULT_BOT_TIMING.maxConsistentIntervals,
      burst: {
        ...DEFAULT_BOT_TIMING.burst,
        ...timingConfig?.burst,
        lengthRange: timingConfig?.burst?.lengthRange ?? DEFAULT_BOT_TIMING.burst.lengthRange,
        multiplierRange:
          timingConfig?.burst?.multiplierRange ?? DEFAULT_BOT_TIMING.burst.multiplierRange,
      },
      calm: {
        ...DEFAULT_BOT_TIMING.calm,
        ...timingConfig?.calm,
        lengthRange: timingConfig?.calm?.lengthRange ?? DEFAULT_BOT_TIMING.calm.lengthRange,
        multiplierRange:
          timingConfig?.calm?.multiplierRange ?? DEFAULT_BOT_TIMING.calm.multiplierRange,
      },
      timeOfDayMultipliers: {
        ...DEFAULT_BOT_TIMING.timeOfDayMultipliers,
        ...timingConfig?.timeOfDayMultipliers,
      },
      marketMultipliers: {
        ...DEFAULT_BOT_TIMING.marketMultipliers,
        ...timingConfig?.marketMultipliers,
      },
    };
  }, [messageInterval, timingConfig]);

  useEffect(() => {
    const updateEnvironment = () => {
      setSessionSlot((prev) => {
        const next = getUtcSessionSlot();
        return next === prev ? prev : next;
      });
      if (Date.now() >= regimeExpiryRef.current) {
        setMarketRegime((prev) => {
          const next = pickRandomRegime(prev);
          regimeExpiryRef.current = Date.now() + getRegimeDurationMs();
          return next;
        });
      }
    };

    updateEnvironment();
    const cadence = 45_000 + Math.random() * 30_000;
    const intervalId = window.setInterval(updateEnvironment, cadence);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Refresh win/loss profile whenever the regime changes to keep narrative aligned
    regimeProfileRef.current = getRegimeWinProfile(marketRegime);
  }, [marketRegime]);

  // Map market condition to template preference
  const getMarketConditionPreference = (): "volatile" | "stable" | "trending" | "ranging" => {
    if (marketCondition.volatility === "high") return "volatile";
    if (marketCondition.trend !== "sideways") return "trending";
    if (marketCondition.volatility === "low") return "ranging";
    return "stable";
  };

  // Update market conditions periodically
  useEffect(() => {
    const updateMarketCondition = () => {
      const volatilityRand = Math.random();
      const trendRand = Math.random();
      const volumeRand = Math.random();

      setMarketCondition({
        volatility:
          volatilityRand > 0.7 ? "high" : volatilityRand > 0.3 ? "medium" : "low",
        trend: trendRand > 0.6 ? "up" : trendRand > 0.3 ? "sideways" : "down",
        volume: volumeRand > 0.6 ? "high" : volumeRand > 0.3 ? "normal" : "low",
      });
    };

    // Update market conditions every 2-5 minutes
    const interval = setInterval(updateMarketCondition, 120000 + Math.random() * 180000);
    updateMarketCondition(); // Initial update

    return () => clearInterval(interval);
  }, []);

  // Filter templates based on current context
  const getFilteredTemplates = useCallback((): MessageTemplate[] => {
    const timeOfDay = getTimeOfDaySlot();
    const marketPref = getMarketConditionPreference();

    return MESSAGE_TEMPLATES.filter((template) => {
      // Skip recently used templates (within last 15 messages)
      if (recentTemplateIds.current.has(template.id)) {
        return false;
      }

      // Check time preference
      if (
        template.timePreference &&
        template.timePreference !== "any" &&
        template.timePreference !== timeOfDay
      ) {
        return false;
      }

      // Check market condition preference
      if (
        template.marketCondition &&
        template.marketCondition !== "any" &&
        template.marketCondition !== marketPref
      ) {
        return false;
      }

      return true;
    });
  }, [marketCondition]);

  // Generate dynamic values for placeholders
  const fillTemplate = useCallback(
    (template: MessageTemplate): string => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const symbol2 = symbols[Math.floor(Math.random() * symbols.length)];
      const basePrice = 30000 + Math.random() * 40000;

      const placeholders: Record<string, string> = {
        symbol,
        symbol2,
        fromSymbol: symbol,
        toSymbol: symbol2,
        price: basePrice.toFixed(2),
        oldPrice: (basePrice * 0.98).toFixed(2),
        newPrice: (basePrice * 1.02).toFixed(2),
        stop: (basePrice * 0.98).toFixed(2),
        target: (basePrice * 1.05).toFixed(2),
        avgPrice: (basePrice * 1.01).toFixed(2),
        resistance: (basePrice * 1.03).toFixed(2),
        support: (basePrice * 0.97).toFixed(2),
        tp: (basePrice * 1.04).toFixed(2),
        sl: (basePrice * 0.96).toFixed(2),
        price1: (basePrice * 0.99).toFixed(2),
        price2: basePrice.toFixed(2),
        price3: (basePrice * 1.01).toFixed(2),
        strike: (basePrice * 1.1).toFixed(2),
        volume: (Math.random() * 50 + 10).toFixed(0),
        size: (Math.random() * 5000 + 1000).toFixed(0),
        correlation: (Math.random() * 40 + 60).toFixed(0),
        ratio: (Math.random() * 2 + 1).toFixed(2),
        spread: (Math.random() * 0.5 + 0.1).toFixed(2),
        direction: Math.random() > 0.5 ? "bullish" : "bearish",
        gain: (Math.random() * 5 + 1).toFixed(1),
        loss: (Math.random() * 3 + 0.5).toFixed(1),
        pnl: (Math.random() * 500 - 100).toFixed(0),
        percent: (Math.random() * 10 + 1).toFixed(1),
        risk: (Math.random() * 2 + 0.5).toFixed(1),
        period: Math.random() > 0.5 ? "3-5 days" : "1-2 weeks",
        entry: Math.floor(Math.random() * 5 + 1).toString(),
        level: Math.floor(Math.random() * 10 + 1).toString(),
        rsi: (Math.random() * 30 + 20).toFixed(0),
        heat: (Math.random() * 30 + 10).toFixed(0),
        limit: "40",
        current: Math.floor(Math.random() * 8 + 3).toString(),
        max: "10",
        available: (Math.random() * 10000 + 5000).toFixed(0),
        increase: (Math.random() * 20 + 10).toFixed(0),
        filled: (Math.random() * 3000 + 1000).toFixed(0),
        total: "5000",
        type: Math.random() > 0.5 ? "BUY" : "SELL",
        visible: "1000",
        hidden: "4000",
        duration: "30 min",
        condition: Math.random() > 0.5 ? "BTC > $70k" : "RSI < 30",
        position: Math.floor(Math.random() * 50 + 1).toString(),
        from: symbol,
        to: symbol2,
        sector: ["DeFi", "Layer 1", "Gaming", "AI"][Math.floor(Math.random() * 4)],
        sectors: Math.floor(Math.random() * 3 + 2).toString(),
        count: Math.floor(Math.random() * 5 + 3).toString(),
        beta: (Math.random() * 0.5 + 0.8).toFixed(2),
        wins: Math.floor(Math.random() * 15 + 10).toString(),
        score: Math.floor(Math.random() * 30 + 70).toString(),
        strength: ["weak", "moderate", "strong"][Math.floor(Math.random() * 3)],
        zscore: (Math.random() * 2 - 1).toFixed(2),
        regime: ["trending", "mean-reverting", "breakout"][Math.floor(Math.random() * 3)],
        value: (Math.random() * 100).toFixed(0),
        interpretation: ["bullish", "neutral", "bearish"][Math.floor(Math.random() * 3)],
        asset: ["BTC", "SPY", "Gold"][Math.floor(Math.random() * 3)],
        strategy: ["Momentum", "Mean Reversion", "Breakout"][Math.floor(Math.random() * 3)],
        timeframe: ["1m", "5m", "15m", "1h"][Math.floor(Math.random() * 4)],
        action: Math.random() > 0.5 ? "bullish" : "bearish",
        fibLevel: ["38.2%", "50%", "61.8%"][Math.floor(Math.random() * 3)],
        chartPosition: Math.random() > 0.5 ? "above" : "below",
        trendDirection: Math.random() > 0.5 ? "bullish" : "bearish",
        touches: Math.floor(Math.random() * 5 + 2).toString(),
        stochCondition: Math.random() > 0.5 ? "overbought" : "oversold",
        pattern: ["H&S", "Double Bottom", "Bull Flag", "Ascending Triangle"][
          Math.floor(Math.random() * 4)
        ],
        atr: (Math.random() * 500 + 100).toFixed(0),
        wave: ["3", "4", "5"][Math.floor(Math.random() * 3)],
        relationship: ["aligned", "divergent"][Math.floor(Math.random() * 2)],
        flow: Math.random() > 0.5 ? "negative" : "positive",
        rate: (Math.random() * 0.1).toFixed(4),
        expiry: ["Dec 29", "Jan 31", "Mar 28"][Math.floor(Math.random() * 3)],
        var: (Math.random() * 1000 + 500).toFixed(0),
      };

      let filled = template.template;
      Object.entries(placeholders).forEach(([key, value]) => {
        filled = filled.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      });

      return filled;
    },
    [symbols]
  );

  // Generate a new message
  const appendRegimeNarrative = useCallback(
    (content: string, template: MessageTemplate): string => {
      if (!OUTCOME_CATEGORIES.includes(template.category)) {
        return content;
      }
      const profile = regimeProfileRef.current;
      const isWinSkew = Math.random() < profile.winRate;
      const toneIcon = profile.tone === "bullish" ? "BULL" : profile.tone === "bearish" ? "BEAR" : "NEUTRAL";
      const descriptor = isWinSkew
        ? `Win rate ${Math.round(profile.winRate * 100)}%`
        : `Loss skew ${profile.lossSkew.toFixed(2)}x`;
      const regimeLabel = marketRegime.toUpperCase();
      const sessionLabel = SESSION_LABELS[sessionSlot];
      return `${content} • ${toneIcon} ${descriptor} · ${regimeLabel} · ${sessionLabel}`;
    },
    [marketRegime, sessionSlot]
  );

  const generateMessage = useCallback((): BotMessage | null => {
    const filteredTemplates = getFilteredTemplates();

    if (filteredTemplates.length === 0) {
      // Reset recent templates if we've exhausted options
      recentTemplateIds.current.clear();
      return null;
    }

    // Weight by priority (high priority messages are 3x more likely)
    const weightedTemplates: MessageTemplate[] = [];
    filteredTemplates.forEach((template) => {
      const priorityWeight = template.priority === "high" ? 3 : template.priority === "medium" ? 2 : 1;
      const regimeWeight =
        REGIME_CATEGORY_WEIGHTS[marketRegime]?.[template.category] ?? 1;
      const sessionWeight =
        SESSION_CATEGORY_WEIGHTS[sessionSlot]?.[template.category] ?? 1;
      const weight = Math.max(1, Math.round(priorityWeight * regimeWeight * sessionWeight));
      for (let i = 0; i < weight; i += 1) {
        weightedTemplates.push(template);
      }
    });

    const template = weightedTemplates[Math.floor(Math.random() * weightedTemplates.length)];
    const content = fillTemplate(template);
    const annotatedContent = appendRegimeNarrative(content, template);

    // Track this template as recently used
    recentTemplateIds.current.add(template.id);

    // Keep only last 15 template IDs (roughly 3 minutes of messages)
    if (recentTemplateIds.current.size > 15) {
      const idsArray = Array.from(recentTemplateIds.current);
      recentTemplateIds.current = new Set(idsArray.slice(-15));
    }

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: template.category,
      content: annotatedContent,
      timestamp: new Date(),
      priority: template.priority,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
    };
  }, [appendRegimeNarrative, getFilteredTemplates, fillTemplate, marketRegime, sessionSlot, symbols]);

  const computeNextInterval = useCallback(() => {
    const varianceFactor = 1 - resolvedTiming.variance + Math.random() * (resolvedTiming.variance * 2);
    const timeOfDayMultiplier =
      resolvedTiming.timeOfDayMultipliers[getTimeOfDaySlot()] ?? 1;

    let interval = resolvedTiming.baseInterval * varianceFactor * timeOfDayMultiplier;

    if (marketCondition.volatility === "high") {
      interval *= resolvedTiming.marketMultipliers.highVolatility;
    } else if (marketCondition.volatility === "low") {
      interval *= resolvedTiming.marketMultipliers.lowVolatility;
    }

    if (marketCondition.trend === "sideways") {
      interval *= resolvedTiming.marketMultipliers.sideways;
    } else {
      interval *= resolvedTiming.marketMultipliers.trending;
    }

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

    interval *= getSessionTempoFactor(sessionSlot);
    interval *= getRegimeTempoFactor(marketRegime);

    interval *= applyWindowMultiplier(burstStateRef, resolvedTiming.burst);
    interval *= applyWindowMultiplier(calmStateRef, resolvedTiming.calm);

    interval = Math.max(interval, resolvedTiming.minInterval);

    const history = intervalHistoryRef.current;
    if (history.length >= resolvedTiming.maxConsistentIntervals - 1) {
      const tolerance = resolvedTiming.baseInterval * 0.05;
      const consistent = history.every((value) => Math.abs(value - interval) <= tolerance);
      if (consistent) {
        interval *= 0.75 + Math.random() * 0.5;
      }
    }

    intervalHistoryRef.current = [
      ...history.slice(-(resolvedTiming.maxConsistentIntervals - 1)),
      interval,
    ];

    return interval;
  }, [marketCondition, marketRegime, resolvedTiming, sessionSlot]);

  useEffect(() => {
    computeIntervalRef.current = computeNextInterval;
  }, [computeNextInterval]);

  // Message generation loop
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setIsActive(false);
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      hasSeededRef.current = false;
      return undefined;
    }

    setIsActive(true);
    burstStateRef.current.remaining = 0;
    calmStateRef.current.remaining = 0;
    intervalHistoryRef.current = [];

    let cancelled = false;

    const seedInitialMessage = () => {
      if (hasSeededRef.current) return;
      const initialMessage = generateMessage();
      if (initialMessage) {
        setMessages([initialMessage]);
        messageHistory.current = [initialMessage];
      }
      hasSeededRef.current = true;
    };

    const pushMessage = () => {
      if (cancelled) return;
      const newMessage = generateMessage();
      if (!newMessage) return;
      setMessages((prev) => {
        const updated = [...prev, newMessage];
        const trimmed = updated.slice(-50);
        messageHistory.current = trimmed;
        return trimmed;
      });
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = computeIntervalRef.current();
      messageTimeoutRef.current = window.setTimeout(() => {
        pushMessage();
        scheduleNext();
      }, delay);
    };

    seedInitialMessage();
    scheduleNext();

    return () => {
      cancelled = true;
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      hasSeededRef.current = false;
    };
  }, [enabled, symbols, generateMessage, resolvedTiming]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageHistory.current = [];
    recentTemplateIds.current.clear();
    intervalHistoryRef.current = [];
    burstStateRef.current.remaining = 0;
    calmStateRef.current.remaining = 0;
    hasSeededRef.current = false;
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
  }, []);

  return {
    messages,
    isActive,
    marketCondition,
    marketRegime,
    session: sessionSlot,
    clearMessages,
  };
}
