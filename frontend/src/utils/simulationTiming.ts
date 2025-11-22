import type { MarketRegime, SessionSlot } from "../types/simulation";

export type TimeOfDaySlot = "morning" | "midday" | "evening" | "night";

const SESSION_WINDOWS: Array<{ slot: SessionSlot; start: number; end: number }> = [
  { slot: "asia_open", start: 23, end: 3 },
  { slot: "asia_mid", start: 3, end: 8 },
  { slot: "europe_open", start: 8, end: 13 },
  { slot: "us_open", start: 13, end: 18 },
  { slot: "us_power", start: 18, end: 22 },
  { slot: "overnight", start: 22, end: 23 },
];

const SESSION_TEMPO_BOUNDS: Record<SessionSlot, [number, number]> = {
  asia_open: [0.95, 1.05],
  asia_mid: [1.05, 1.2],
  europe_open: [0.85, 0.95],
  us_open: [0.7, 0.88],
  us_power: [0.65, 0.85],
  overnight: [1.15, 1.35],
};

const REGIME_TEMPO_BOUNDS: Record<MarketRegime, [number, number]> = {
  bull: [0.85, 0.95],
  bear: [0.95, 1.1],
  sideways: [1.05, 1.2],
  volatile: [0.65, 0.85],
};

const REGIME_WIN_BOUNDS: Record<MarketRegime, { winRate: [number, number]; lossSkew: [number, number]; tone: "bullish" | "bearish" | "neutral" }> = {
  bull: { winRate: [0.62, 0.72], lossSkew: [1.0, 1.2], tone: "bullish" },
  bear: { winRate: [0.32, 0.45], lossSkew: [1.2, 1.45], tone: "bearish" },
  sideways: { winRate: [0.48, 0.55], lossSkew: [1.05, 1.2], tone: "neutral" },
  volatile: { winRate: [0.4, 0.55], lossSkew: [1.3, 1.6], tone: "neutral" },
};

export function getTimeOfDaySlot(date: Date = new Date()): TimeOfDaySlot {
  const hour = date.getUTCHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "midday";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getUtcSessionSlot(date: Date = new Date()): SessionSlot {
  const hour = date.getUTCHours();
  for (const window of SESSION_WINDOWS) {
    if (window.start > window.end) {
      if (hour >= window.start || hour < window.end) {
        return window.slot;
      }
    } else if (hour >= window.start && hour < window.end) {
      return window.slot;
    }
  }
  return "asia_mid";
}

export function getSessionTempoFactor(slot: SessionSlot): number {
  const [min, max] = SESSION_TEMPO_BOUNDS[slot];
  return randomBetween(min, max);
}

export function pickRandomRegime(previous?: MarketRegime): MarketRegime {
  const regimes: MarketRegime[] = ["bull", "bear", "sideways", "volatile"];
  let candidate = regimes[randomIntBetween(0, regimes.length - 1)];
  if (previous && Math.random() < 0.6) {
    // Avoid repeating the same regime most of the time
    let safety = 0;
    while (candidate === previous && safety < 5) {
      candidate = regimes[randomIntBetween(0, regimes.length - 1)];
      safety += 1;
    }
  }
  return candidate;
}

export function getRegimeDurationMs(): number {
  const minutes = randomBetween(30, 60);
  const jitter = randomBetween(-3, 3);
  return Math.max(20, minutes + jitter) * 60_000;
}

export function getRegimeTempoFactor(regime: MarketRegime): number {
  const [min, max] = REGIME_TEMPO_BOUNDS[regime];
  return randomBetween(min, max);
}

export function getRegimeWinProfile(regime: MarketRegime) {
  const { winRate, lossSkew, tone } = REGIME_WIN_BOUNDS[regime];
  return {
    winRate: randomBetween(winRate[0], winRate[1]),
    lossSkew: randomBetween(lossSkew[0], lossSkew[1]),
    tone,
  };
}

export function getRegimeTone(regime: MarketRegime): "bullish" | "bearish" | "neutral" {
  return REGIME_WIN_BOUNDS[regime].tone;
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomIntBetween(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}
