export type MarketRegime = "bull" | "bear" | "sideways" | "volatile";

export type SessionSlot =
  | "asia_open"
  | "asia_mid"
  | "europe_open"
  | "us_open"
  | "us_power"
  | "overnight";

export type SessionProfile = {
  label: string;
  tempoFactor: number;
};