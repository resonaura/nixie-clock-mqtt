import axios, { AxiosInstance } from "axios";
import { env } from "./config.js";
import { NixieConfig } from "./types.js";
import { log } from "./utils.js";

// ── HTTP client ───────────────────────────────────────────────────────────────

function createHttpClient(): AxiosInstance {
  return axios.create({
    baseURL: `http://${env.NIXIE_HOST}`,
    timeout: 5_000,
  });
}

let http = createHttpClient();

export function reinitClient(): void {
  http = createHttpClient();
}

async function get<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const res = await http.get<T>(path, { params });
  return res.data;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch full device config */
export async function getConfig(): Promise<NixieConfig> {
  return get<NixieConfig>("/config");
}

/**
 * Set colour of a single tube.
 *
 * The firmware uses:
 *   h = 0–360  (hue)
 *   s = 0–100  (saturation percent)
 *   v = 0–100  (brightness percent)
 */
export async function setTubeColor(
  tube: number,
  h: number,
  s: number,
  v: number,
): Promise<void> {
  log.debug(`tubecolor t=${tube} h=${h} s=${s} v=${v}`);
  await get("/tubecolor", { t: tube, h, s, v });
}

/** Set all 6 tubes to the same colour in sequence. */
export async function setAllTubesColor(
  h: number,
  s: number,
  v: number,
): Promise<void> {
  for (let i = 1; i <= 6; i++) {
    await setTubeColor(i, h, s, v);
  }
}

/**
 * Set color mode (the `m` parameter).
 *
 * m=1  Custom    — individual tube colours active
 * m=2  Rainbow   — rainbow gradient effect
 * m=3  Breathing — breathing gradient effect
 * m=4  Flowing   — flowing gradient effect
 * m=5  Test      — test mode
 *
 * The `s` parameter (display style) is always sent alongside:
 *   s=1  Normal
 *   s=2  Carry
 *   s=3  Jumping
 */
export async function setColorMode(m: number, s: number): Promise<void> {
  log.debug(`mode m=${m} s=${s}`);
  await get("/mode", { m, s });
}

/**
 * Set the alarm time.
 * @param h  Hour 0–23
 * @param m  Minute 0–59
 */
export async function setAlarm(h: number, m: number): Promise<void> {
  log.debug(`alarm h=${h} m=${m}`);
  await get("/alarm", { h, m });
}

/**
 * Start or stop the countdown timer.
 * @param min  Minutes 1–99; pass 0 to stop.
 */
export async function setTimer(min: number): Promise<void> {
  log.debug(`timer min=${min}`);
  await get("/timer", { min });
}

/**
 * Set the timezone on the clock.
 *
 * The firmware's /time endpoint expects a 1-based index:
 *   index = tzOffsetHours + 13
 *
 * Examples:
 *   UTC-12  → t=1
 *   UTC+0   → t=13
 *   UTC+3   → t=16  (Moscow)
 *   UTC+5.5 → t=18.5 (India)
 *   UTC+12  → t=25
 */
export async function setTimezone(tzOffsetHours: number): Promise<void> {
  const t = tzOffsetHours + 13;
  log.debug(`time t=${t} (offset=${tzOffsetHours})`);
  await get("/time", { t });
}

/**
 * Set 12h / 24h display format.
 *
 * The firmware's /tm endpoint receives s=12 or s=24.
 *
 * @param use24h  true → 24h mode (s=24), false → 12h mode (s=12)
 */
export async function setTimeFormat(use24h: boolean): Promise<void> {
  const s = use24h ? 24 : 12;
  log.debug(`tm s=${s}`);
  await get("/tm", { s });
}

/**
 * Push the current UTC time to the clock via /uptm.
 *
 * The firmware applies its own stored timezone offset internally, so we
 * send pure UTC. This avoids any double-offset issues regardless of what
 * timezone the container is running in.
 *
 * Parameter notes (confirmed from firmware JS):
 *   t=0  — standard time push (not a DST flag)
 *   h    — UTC hour (0–23)
 *   m    — UTC minute (0–59)
 *   s    — UTC second (0–59)
 *   mo   — month 1-based (firmware expects 1–12)
 *   d    — day of month (1–31)
 *   y    — full year (e.g. 2026)
 */
export async function syncTimeWithOffset(
  _tzOffsetHours: number,
): Promise<void> {
  const now = new Date();

  const params = {
    t: 0,
    h: now.getUTCHours(),
    m: now.getUTCMinutes(),
    s: now.getUTCSeconds(),
    y: now.getUTCFullYear(),
    // firmware expects 1-based month
    mo: now.getUTCMonth() + 1,
    d: now.getUTCDate(),
  };

  log.debug(
    `uptm UTC → ${String(params.h).padStart(2, "0")}:${String(params.m).padStart(2, "0")}:${String(params.s).padStart(2, "0")} ${params.d}/${params.mo}/${params.y}`,
  );
  await get("/uptm", params);
}

/**
 * One-shot sync wrapper used by the manual "Sync Time" button.
 */
export async function syncTime(tzOffsetHours = 0): Promise<void> {
  await syncTimeWithOffset(tzOffsetHours);
}

/**
 * Fetch firmware version string from the clock.
 * Converts raw int e.g. 3101 → "3.101".
 */
export async function getFirmwareVersion(): Promise<string> {
  const data = await get<{ ver: number }>("/version");
  const raw = String(data.ver);
  return `${raw.slice(0, raw.length - 3)}.${raw.slice(-3)}`;
}
