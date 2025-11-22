import { palette } from "../../theme/palette";

export type ActiveOrder = {
  id: string;
  venue: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  status: string;
  ts: number;
};

type ActiveOrdersProps = {
  orders: ActiveOrder[];
};

export function ActiveOrders({ orders }: ActiveOrdersProps) {
  return (
    <section style={widgetStyle}>
      <header style={headerStyle}>Bot Live Orders</header>
      <div style={tableContainerStyle}>
        <div style={tableHeadStyle}>
          <span>Venue</span>
          <span>Symbol</span>
          <span>Side</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Status</span>
        </div>
        <div style={bodyStyle}>
          {orders.map((order) => (
            <article key={order.id} style={rowStyle}>
              <span>{order.venue}</span>
              <span>{order.symbol}</span>
              <span style={{ color: order.side === "buy" ? palette.accent.buy : palette.accent.sell }}>
                {order.side.toUpperCase()}
              </span>
              <span>{order.quantity.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
              <span>{order.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span>{order.status}</span>
            </article>
          ))}
          {!orders.length && <div style={emptyStyle}>No working orders.</div>}
        </div>
      </div>
    </section>
  );
}

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

const tableContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: "560px",
};

const tableHeadStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 1fr 0.7fr 1fr 1fr 0.8fr",
  padding: "8px 16px",
  fontSize: 11,
  color: palette.text.muted,
  background: "rgba(255,255,255,0.02)",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 1fr 0.7fr 1fr 1fr 0.8fr",
  padding: "10px 16px",
  borderBottom: `1px dashed ${palette.grid.line}`,
  fontSize: 12,
};

const emptyStyle: React.CSSProperties = {
  padding: "32px",
  textAlign: "center",
  color: palette.text.muted,
};
