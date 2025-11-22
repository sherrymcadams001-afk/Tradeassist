export type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
};

export type CandleFeedMode = "live" | "simulated";

export type CandleFeedStatus = "idle" | "connecting" | "live" | "fallback" | "error";

export type CandleFeedState = {
  candles: Candle[];
  mode: CandleFeedMode;
  status: CandleFeedStatus;
  error: string | null;
};
