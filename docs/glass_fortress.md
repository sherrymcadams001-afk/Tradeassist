# Glass Fortress UI Spec

## Dashboard Layout
- **Grid System:** Twelve-column responsive grid driven by `react-grid-layout` with 8px baseline spacing. Breakpoints collapse to 6 columns on tablets and stacked cards on mobile.
- **Widget Model:** Every widget implements `{ id, title, component, minW, minH }`. Layout state persists to Redis so operators always return to the same cockpit.
- **Drag Physics:** Drag handles sit on the widget header rail; resizing snaps to the baseline to avoid pixel drift. Interactions never block data paints—content re-renders asynchronously while the chrome stays at 60fps.
- **Primary Arrangement:**
  1. **RealTimeTicker (w=6, h=4):** Upper left, spans two rows.
  2. **ActiveOrders (w=6, h=4):** Upper right for execution context.
  3. **Risk Thermals (placeholder) & Latency Monitor:** Bottom row, w=4 each, leaving headroom for future modules.

## Color & Typography Palette
| Token | Value | Usage |
| --- | --- | --- |
| `obsidian.900` | `#0a0a0a` | Global background |
| `obsidian.800` | `#10141a` | Panels & widgets |
| `grid.line` | `#1b1f27` | Grid separators |
| `text.primary` | `#e6f1ff` | Body copy |
| `text.muted` | `#8aa0c2` | Labels, timestamps |
| `accent.buy` | `#00f7d2` | Buy signals |
| `accent.sell` | `#ff3864` | Sell signals |
| `accent.idle` | `#4c6ef5` | Neutral state |
| `alert.warning` | `#f7b801` | Circuit breakers |
| `glow.teal` | `linear-gradient(90deg, #0bbba0, #34f5c6)` | HUD highlights |
| `glow.crimson` | `linear-gradient(90deg, #ff3864, #ff5f40)` | Sell highlights |
| `font.mono` | `"IBM Plex Mono", "Space Grotesk", monospace` | Data density |

The palette enforces high contrast without neon fatigue. All typography defaults to the mono stack with 12/16px rhythm for ticker data and 14/20px for headers.

## Interaction Tenets
1. **Institutional Opacity:** Complex strategy internals remain hidden; widgets expose only actionable intel, reinforced through micro-animations (fade/slide <120ms).
2. **Perception Authority:** Layout never jitters; new data fades in with opacity ramps to preserve confidence.
3. **Latency Respect:** WebSocket hooks stream directly into widget state stores; expensive formatting and aggregations happen off the paint cycle via `requestIdleCallback` fallbacks.
