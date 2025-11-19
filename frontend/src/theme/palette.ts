export const palette = {
  background: {
    base: "#0a0a0a",
    surface: "#10141a",
    elevated: "#161b24",
  },
  text: {
    primary: "#e6f1ff",
    muted: "#8aa0c2",
    inverse: "#0a0a0a",
  },
  accent: {
    buy: "#00f7d2",
    sell: "#ff3864",
    idle: "#4c6ef5",
  },
  alert: {
    warning: "#f7b801",
  },
  grid: {
    line: "#1b1f27",
  },
  typography: {
    mono: '"IBM Plex Mono", "Space Grotesk", monospace',
  },
} as const;

export type Palette = typeof palette;
