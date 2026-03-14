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
 *
 * The global brightness from /config is stored as `light` (0–254).
 * Its equivalent v value = Math.round(light / 2.55).
 * Per-tube s from /config is stored as 0–254; to get percent: Math.round(s / 2.55).
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
 * m=1  Custom    — individual tube colours active, display style applies
 * m=2  Rainbow   — rainbow gradient effect
 * m=3  Breathing — breathing gradient effect
 * m=4  Flowing   — flowing gradient effect
 * m=5  Test      — test mode
 *
 * The `s` parameter (display style) is always sent but only has visible
 * effect when m=1:
 *   s=1  Normal
 *   s=2  Carry
 *   s=3  Jumping
 */
export async function setColorMode(m: number, s: number): Promise<void> {
  log.debug(`mode m=${m} s=${s}`);
  await get("/mode", { m, s });
}

/**
 * Set display style only (Normal/Carry/Jumping).
 * Keeps the current color mode from the provided config snapshot,
 * or defaults to m=1 (Custom) if none given.
 */
export async function setDisplayStyle(
  s: number,
  currentMode = 1,
): Promise<void> {
  log.debug(`display style m=${currentMode} s=${s}`);
  await get("/mode", { m: currentMode, s });
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
 * Enable or disable Daylight Saving Time.
 */
export async function setDST(enabled: boolean): Promise<void> {
  log.debug(`enDST d=${enabled ? 1 : 0}`);
  await get("/enDST", { d: enabled ? 1 : 0 });
}

/**
 * Set the timezone on the clock.
 *
 * The firmware's /time endpoint does NOT accept a raw UTC offset.
 * It expects a 1-based index into the firmware's internal timezone list:
 *
 *   index = tzOffsetHours + 13
 *
 * Examples:
 *   UTC-12  → t=1
 *   UTC+0   → t=13
 *   UTC+3   → t=16  (Moscow)
 *   UTC+5.5 → t=18.5  (India — firmware stores as fractional)
 *   UTC+12  → t=25
 *
 * This was confirmed by deobfuscating initTimeZone (reads cfg.tz, adds 13,
 * stores as dataset.value) and sendTimeZone (reads that value, sends as t=).
 */
export async function setTimezone(tzOffsetHours: number): Promise<void> {
  const t = tzOffsetHours + 13;
  log.debug(`time t=${t} (offset=${tzOffsetHours})`);
  await get("/time", { t });
}

/**
 * Set 12h / 24h display format.
 *
 * The firmware's /tm endpoint receives s=12 or s=24 — the literal hour-count
 * value, NOT a boolean flag. Confirmed by deobfuscating sendTubeMode and the
 * radio button values in the HTML (radio12 / radio24).
 *
 * @param use24h  true → 24h mode (s=24), false → 12h mode (s=12)
 */
export async function setTimeFormat(use24h: boolean): Promise<void> {
  const s = use24h ? 24 : 12;
  log.debug(`tm s=${s}`);
  await get("/tm", { s });
}

/**
 * Push the current time to the clock with an explicit timezone offset applied.
 *
 * Takes UTC now, shifts it by tzOffsetHours, and sends the resulting
 * decomposed local time via /uptm. This is called every second by the
 * timesync loop so the clock never drifts.
 *
 * Using UTC math (Date.getUTC*) means the result is correct regardless of
 * what timezone the server/container is running in.
 *
 * @param tzOffsetHours  e.g. -8 for PST, +3 for MSK, 5.5 for IST, 0 for UTC
 */
export async function syncTimeWithOffset(tzOffsetHours: number): Promise<void> {
  const utcMs = Date.now() + tzOffsetHours * 3_600_000;
  const t = new Date(utcMs);

  const params = {
    // t=0: we manage DST ourselves by choosing the right offset
    t: 0,
    h: t.getUTCHours(),
    m: t.getUTCMinutes(),
    s: t.getUTCSeconds(),
    y: t.getUTCFullYear(),
    // firmware expects 0-based month (matches JS Date.getMonth())
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
  };

  log.debug(
    `uptm offset=${tzOffsetHours}h → ${String(params.h).padStart(2, "0")}:${String(params.m).padStart(2, "0")}:${String(params.s).padStart(2, "0")}`,
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
