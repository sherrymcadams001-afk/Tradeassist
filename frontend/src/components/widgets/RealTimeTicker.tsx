import { memo } from "react";

import { palette } from "../../theme/palette";

type TickerRow = {
  symbol: string;
  bid?: number;
  ask?: number;
  last?: number;
  price?: number;
  ts: number;
};

type RealTimeTickerProps = {
  ticks: Record<string, TickerRow>;
};

export const RealTimeTicker = memo(function RealTimeTicker({ ticks }: RealTimeTickerProps) {
  const rows = Object.values(ticks).sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <section style={widgetStyle}>
      <header style={headerStyle}>Signal Stream</header>
      <div style={tableHeadStyle}>
        <span>Symbol</span>
        <span>Bid</span>
        <span>Ask</span>
        <span>Last</span>
        <span>Latency</span>
      </div>
      <div style={bodyStyle}>
        {rows.map((row) => (
          <article key={row.symbol} style={rowStyle}>
            <span>{row.symbol}</span>
            <span style={{ color: palette.accent.buy }}>{renderValue(row.bid ?? row.price)}</span>
            <span style={{ color: palette.accent.sell }}>{renderValue(row.ask ?? row.price)}</span>
            <span style={{ color: palette.accent.idle }}>{renderValue(row.last ?? row.price)}</span>
            <span>{renderLatency(row.ts)}</span>
          </article>
        ))}
        {!rows.length && <div style={emptyStyle}>Awaiting market data…</div>}
      </div>
    </section>
  );
});

const widgetStyle: React.CSSProperties = {
  background: palette.background.surface,
  border: `1px solid ${palette.grid.line}`,
  borderRadius: 8,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 0 24px rgba(0,0,0,0.45)",
};

const headerStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: `1px solid ${palette.grid.line}`,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontSize: 12,
};

const tableHeadStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  padding: "8px 16px",
  fontSize: 12,
  color: palette.text.muted,
  background: "rgba(255,255,255,0.02)",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  padding: "10px 16px",
  borderBottom: `1px dashed ${palette.grid.line}`,
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  padding: "32px",
  textAlign: "center",
  color: palette.text.muted,
};

function renderLatency(ts: number) {
  const delta = Date.now() - ts;
  const label = delta > 1000 ? `${(delta / 1000).toFixed(1)}s` : `${delta.toFixed(0)}ms`;
  return label;
}

function renderValue(value?: number) {
  if (typeof value !== "number") {
    return "—";
  }
  return value.toFixed(2);
}
