import { NixieConfig } from "./types.js";
import { env } from "./config.js";

// ── Logging ───────────────────────────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: keyof typeof LEVELS): boolean {
  return LEVELS[level] >= LEVELS[env.LOG_LEVEL];
}

export const log = {
  debug: (...args: unknown[]) =>
    shouldLog("debug") && console.debug("🔍", ...args),
  info: (...args: unknown[]) =>
    shouldLog("info") && console.log("ℹ️ ", ...args),
  warn: (...args: unknown[]) =>
    shouldLog("warn") && console.warn("⚠️ ", ...args),
  error: (...args: unknown[]) =>
    shouldLog("error") && console.error("❌", ...args),
  ok: (...args: unknown[]) => shouldLog("info") && console.log("✅", ...args),
};

// ── Colour conversion ─────────────────────────────────────────────────────────

/**
 * Convert HSV (h: 0–360, s: 0–100, v: 0–100) to RGB (0–255 each).
 */
export function hsvToRgb(
  h: number,
  s: number,
  v: number,
): [number, number, number] {
  const sv = s / 100;
  const vv = v / 100;
  const c = vv * sv;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vv - c;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Convert RGB (0–255 each) to HSV (h: 0–360, s: 0–100, v: 0–100).
 */
export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;

  return {
    h: Math.round(h),
    s: Math.round((max === 0 ? 0 : d / max) * 100),
    v: Math.round(max * 100),
  };
}

/**
 * HA MQTT brightness (0–255) → clock V value (0–100)
 */
export function haBrightToV(brightness: number): number {
  return Math.round((brightness / 255) * 100);
}

/**
 * Clock V value (0–100) → HA MQTT brightness (0–255)
 */
export function vToHaBright(v: number): number {
  return Math.round((v / 100) * 255);
}

/**
 * Clock config stores saturation as 0–254; normalise to 0–100 for HA.
 */
export function configSatToPercent(s: number): number {
  return Math.round((s / 254) * 100);
}

/**
 * Extract per-tube HSV from a NixieConfig snapshot.
 * Returns h (0–360), s (0–100), v (0–100).
 */
export function tubeHSV(
  cfg: NixieConfig,
  tube: number,
): { h: number; s: number; v: number } {
  const raw = cfg as unknown as Record<string, number>;
  const h = raw[`h${tube}`]!;
  const s = configSatToPercent(raw[`s${tube}`]!);
  const v = Math.round((cfg.light / 254) * 100);
  return { h, s, v };
}

// ── State normalisation ───────────────────────────────────────────────────────

export function normalizeValue(
  domain: string,
  attr: string,
  value: unknown,
): unknown {
  if (domain === "switch") {
    return value ? "ON" : "OFF";
  }

  if (domain === "select") {
    if (attr === "mode") {
      return (
        { 1: "Clock", 2: "Countdown", 3: "Cycle" }[Number(value)] ?? "Clock"
      );
    }
    if (attr === "speed") {
      return { 1: "Slow", 2: "Medium", 3: "Fast" }[Number(value)] ?? "Medium";
    }
  }

  if (domain === "number") {
    return Number(value);
  }

  return value;
}
