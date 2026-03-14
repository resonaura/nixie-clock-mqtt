import { NixieConfig } from "./types.js";
import {
  COLOR_MODE_NAMES,
  DISPLAY_STYLE_NAMES,
  TIMEZONES,
  tzByOffset,
} from "./types.js";
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

// ── Brightness helpers ────────────────────────────────────────────────────────

/**
 * HA MQTT brightness (0–255) → clock V value (0–100).
 */
export function haBrightToV(brightness: number): number {
  return Math.round((brightness / 255) * 100);
}

/**
 * Clock V value (0–100) → HA MQTT brightness (0–255).
 */
export function vToHaBright(v: number): number {
  return Math.round((v / 100) * 255);
}

/**
 * Convert raw saturation from /config (0–254) to percent (0–100).
 * The firmware stores saturation as 0–254, same scale as brightness.
 * Formula used in the firmware JS: s / 2.55
 */
export function configSatToPercent(s: number): number {
  return Math.round(s / 2.55);
}

/**
 * Convert raw brightness (light field, 0–254) from /config to percent (0–100).
 * Formula used in the firmware JS: light / 2.55
 */
export function configLightToV(light: number): number {
  return Math.round(light / 2.55);
}

/**
 * Extract per-tube HSV from a NixieConfig snapshot.
 *
 * Returns h (0–360), s (0–100), v (0–100).
 *
 * NOTE: v is GLOBAL — all tubes share the same brightness (`light` field).
 * Setting per-tube brightness in HA will actually adjust the global level.
 * This matches how the firmware works: there is no independent per-tube v.
 */
export function tubeHSV(
  cfg: NixieConfig,
  tube: number,
): { h: number; s: number; v: number } {
  const raw = cfg as unknown as Record<string, number>;
  const h = raw[`h${tube}`]!;
  const s = configSatToPercent(raw[`s${tube}`]!);
  const v = configLightToV(cfg.light);
  return { h, s, v };
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Get the timezone label for the current tz offset from /config.
 * Falls back to a plain "UTC±X" label if the offset isn't in our list.
 */
export function tzLabel(tzOffset: number): string {
  const entry = tzByOffset(tzOffset);
  if (entry) return entry.label;
  // fallback for any offset not in the list
  const sign = tzOffset >= 0 ? "+" : "";
  return `UTC${sign}${tzOffset}:00`;
}

/**
 * Convert a timezone label string back to the numeric offset.
 * Returns 0 (UTC) if not found.
 */
export function tzOffsetFromLabel(label: string): number {
  const entry = TIMEZONES.find((z) => z.label === label);
  return entry ? entry.offset : 0;
}

// ── State normalisation ───────────────────────────────────────────────────────

/**
 * Convert a raw config value to the string that gets published to the
 * corresponding HA MQTT state topic.
 */
export function normalizeValue(
  domain: string,
  attr: string,
  value: unknown,
): unknown {
  if (domain === "switch") {
    return value ? "ON" : "OFF";
  }

  if (domain === "select") {
    if (attr === "color_mode") {
      return COLOR_MODE_NAMES[Number(value)] ?? "Custom";
    }
    if (attr === "display_style") {
      return DISPLAY_STYLE_NAMES[Number(value)] ?? "Normal";
    }
    if (attr === "timezone") {
      return tzLabel(Number(value));
    }
  }

  if (domain === "number") {
    return Number(value);
  }

  return value;
}
