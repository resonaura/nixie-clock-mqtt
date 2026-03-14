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

/** Re-create the client (e.g. after host config change) */
export function reinitClient(): void {
  http = createHttpClient();
}

// ── Low-level GET helper ──────────────────────────────────────────────────────

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
 * @param tube  1–6
 * @param h     Hue 0–360
 * @param s     Saturation 0–100
 * @param v     Value/brightness 0–100
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

/**
 * Set all 6 tubes to the same colour in sequence.
 */
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
 * Set display mode and cycle speed.
 * @param m  Mode: 1 = Clock, 2 = Countdown, 3 = Cycle
 * @param s  Speed: 1 = Slow, 2 = Medium, 3 = Fast
 */
export async function setMode(m: number, s: number): Promise<void> {
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
 * Enable or disable Daylight Saving Time.
 * @param enabled  true = DST on, false = DST off
 */
export async function setDST(enabled: boolean): Promise<void> {
  log.debug(`enDST d=${enabled ? 1 : 0}`);
  await get("/enDST", { d: enabled ? 1 : 0 });
}

/**
 * Set the timezone offset.
 * @param tz  Hours offset, e.g. -8 for PST, +1 for CET
 */
export async function setTimezone(tz: number): Promise<void> {
  log.debug(`time t=${tz}`);
  await get("/time", { t: tz });
}

/**
 * Push the current system time to the clock.
 * Uses the server's local time — run this on a machine with correct time/tz set.
 */
export async function syncTime(): Promise<void> {
  const now = new Date();
  const params = {
    // t=0 means no DST adjustment from the device side (we already send correct local time)
    t: 0,
    h: now.getHours(),
    m: now.getMinutes(),
    s: now.getSeconds(),
    y: now.getFullYear(),
    // HAR shows mo as 0-based
    mo: now.getMonth(),
    d: now.getDate(),
  };
  log.debug("uptm", params);
  await get("/uptm", params);
}

/**
 * Fetch firmware version string from the clock.
 */
export async function getFirmwareVersion(): Promise<string> {
  const data = await get<{ ver: number }>("/version");
  // Convert e.g. 3101 → "3.101"
  const raw = String(data.ver);
  return `${raw.slice(0, raw.length - 3)}.${raw.slice(-3)}`;
}
