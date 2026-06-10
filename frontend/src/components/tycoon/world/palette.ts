// Canvas cannot read CSS variables per-draw, so the design tokens are resolved once at mount
// (with hardcoded fallbacks matching styles.css). The box-face hexes mirror the old SVG `.bld`
// palette for visual continuity with the rest of the design system.

import type { GpuTierId } from "../../../game/types";

export interface Palette {
  cyan: string;
  cyanHi: string;
  green: string;
  amber: string;
  red: string;
  blue: string;
  violet: string;
  magenta: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
  voidC: string;
  base: string;
  panel: string;
  panel2: string;
  border: string;
  faceL: string;
  faceR: string;
  faceT: string;
  faceTSel: string;
  rim: string;
}

const FALLBACK: Palette = {
  cyan: "#22d3ee",
  cyanHi: "#5ce8ff",
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#f87171",
  blue: "#60a5fa",
  violet: "#c084fc",
  magenta: "#f472b6",
  fg: "#e6e9f0",
  fgMuted: "#9aa3b8",
  fgDim: "#5e6781",
  voidC: "#07090f",
  base: "#0b0e14",
  panel: "#101521",
  panel2: "#161c2b",
  border: "#232a3b",
  faceL: "#0b1020",
  faceR: "#11192c",
  faceT: "#1b2440",
  faceTSel: "#243156",
  rim: "rgba(255,255,255,0.14)",
};

export function resolvePalette(): Palette {
  try {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string): string => cs.getPropertyValue(name).trim() || fb;
    return {
      ...FALLBACK,
      cyan: v("--c-cyan", FALLBACK.cyan),
      cyanHi: v("--c-cyan-hi", FALLBACK.cyanHi),
      green: v("--c-green", FALLBACK.green),
      amber: v("--c-amber", FALLBACK.amber),
      red: v("--c-red", FALLBACK.red),
      blue: v("--c-blue", FALLBACK.blue),
      violet: v("--c-violet", FALLBACK.violet),
      magenta: v("--c-magenta", FALLBACK.magenta),
      fg: v("--c-fg-1", FALLBACK.fg),
      fgMuted: v("--c-fg-2", FALLBACK.fgMuted),
      fgDim: v("--c-fg-3", FALLBACK.fgDim),
      voidC: v("--c-void", FALLBACK.voidC),
      base: v("--c-base", FALLBACK.base),
      panel: v("--c-panel", FALLBACK.panel),
      panel2: v("--c-panel-2", FALLBACK.panel2),
      border: v("--c-border", FALLBACK.border),
    };
  } catch {
    return FALLBACK;
  }
}

/** "#rrggbb" or "rgb(r,g,b)" → "rgba(r,g,b,a)". Unknown formats pass through. */
export function withAlpha(color: string, a: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(color);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x) => parseFloat(x));
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

/** Sled/accent tint per GPU tier (matches the token hues used across the UI). */
export function tierColor(pal: Palette, tier: GpuTierId | undefined): string {
  switch (tier) {
    case "a100":
      return pal.blue;
    case "h200":
      return pal.violet;
    case "b200":
      return pal.amber;
    default:
      return pal.cyan; // h100
  }
}
