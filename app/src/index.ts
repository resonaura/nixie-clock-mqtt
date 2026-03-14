import "./config.js";
import { env } from "./config.js";
import { createMqttClient, AVAILABILITY_TOPIC } from "./mqtt.js";
import { publishDiscovery } from "./discovery.js";
import { ENTITIES } from "./entities.js";
import {
  getConfig,
  setTubeColor,
  setAllTubesColor,
  setColorMode,
  setAlarm,
  setTimer,
  setTimezone,
  setTimeFormat,
  syncTime,
  getFirmwareVersion,
} from "./nixie.js";
import { startTimeSync } from "./timesync.js";
import {
  LightCommand,
  MQTTDevice,
  NixieConfig,
  COLOR_MODE_IDS,
  COLOR_MODE_NAMES,
  tzByLabel,
} from "./types.js";
import {
  log,
  tubeHSV,
  haBrightToV,
  vToHaBright,
  configLightToV,
  tzLabel,
} from "./utils.js";

// ── MQTT device descriptor ────────────────────────────────────────────────────

const MQTT_DEVICE: MQTTDevice = {
  id: "nixie_bedroom_clock",
  identifiers: ["nixie_bedroom_clock"],
  name: "Clocteck RGB Tube Clock",
  manufacturer: "Clocteck",
  model: "RGB Tube Clock (LED Nixie Simulation)",
  sw_version: "3.101",
};

// ── State ─────────────────────────────────────────────────────────────────────

let lastConfig: NixieConfig | null = null;
// Last non-zero brightness (v, 0–100). Used to restore brightness on ON command
// when the device reports light=0 (all tubes off).
let lastNonZeroV = 100;
// When true, the next poll() will publish state even if config hasn't changed.
// Set after every command so HA gets instant feedback.
let forcePollPublish = false;

// ── MQTT client ───────────────────────────────────────────────────────────────

const client = createMqttClient();

// ── Publish helper ────────────────────────────────────────────────────────────

function publish(topic: string, payload: string, retain = false): void {
  client.publish(topic, payload, { retain, qos: 1 });
}

// ── Discovery ─────────────────────────────────────────────────────────────────

client.on("connect", () => {
  log.ok("MQTT connected — publishing discovery…");

  ENTITIES.forEach((e) => publishDiscovery(client, MQTT_DEVICE, e));

  log.ok(
    `Published ${ENTITIES.length} discovery entries for ${MQTT_DEVICE.name}`,
  );

  client.subscribe("nixie_clock/+/set", (err) => {
    if (err) log.error("Subscribe failed:", err.message);
    else log.info("Subscribed to nixie_clock/+/set");
  });

  void poll();
});

// ── State publisher ───────────────────────────────────────────────────────────

function publishState(cfg: NixieConfig): void {
  const globalV = configLightToV(cfg.light);
  if (globalV > 0) lastNonZeroV = globalV;

  // Current color mode name (for effect state on all_tubes)
  const effectName = COLOR_MODE_NAMES[cfg.mode] ?? "Custom";

  // Per-tube lights
  for (let i = 1; i <= 6; i++) {
    const { h, s } = tubeHSV(cfg, i);
    publish(
      `homeassistant/light/${MQTT_DEVICE.id}/tube_${i}/state`,
      JSON.stringify({
        state: globalV > 0 ? "ON" : "OFF",
        color_mode: "hs",
        color: { h, s },
        brightness: vToHaBright(globalV),
      }),
    );
  }

  // All-tubes master — representative colour from tube 1 + current effect
  {
    const { h, s } = tubeHSV(cfg, 1);
    publish(
      `homeassistant/light/${MQTT_DEVICE.id}/all_tubes/state`,
      JSON.stringify({
        state: globalV > 0 ? "ON" : "OFF",
        color_mode: "hs",
        color: { h, s },
        brightness: vToHaBright(globalV),
        effect: effectName,
      }),
    );
  }

  // Timezone select
  publish(
    `homeassistant/select/${MQTT_DEVICE.id}/timezone/state`,
    tzLabel(cfg.tz),
  );

  // 24h format switch
  publish(
    `homeassistant/switch/${MQTT_DEVICE.id}/time_format/state`,
    cfg.is24h ? "ON" : "OFF",
  );

  // Alarm numbers
  publish(
    `homeassistant/number/${MQTT_DEVICE.id}/alarm_hour/state`,
    String(cfg.alarmh),
  );
  publish(
    `homeassistant/number/${MQTT_DEVICE.id}/alarm_minute/state`,
    String(cfg.alarmm),
  );

  // Timer — not stored in /config (stateless on device), skip

  log.debug("State published");
}

// ── Polling ───────────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  try {
    const cfg = await getConfig();

    publish(AVAILABILITY_TOPIC, "online", true);

    const changed = JSON.stringify(cfg) !== JSON.stringify(lastConfig);

    if (changed || forcePollPublish) {
      if (changed) log.info("Config changed — publishing state");
      else log.debug("Force-publishing state after command");

      forcePollPublish = false;

      // (Re)start timesync when tz changes or on first fetch
      if (lastConfig === null || lastConfig.tz !== cfg.tz) {
        log.info(
          `Timezone: ${tzLabel(cfg.tz)} (${cfg.tz >= 0 ? "+" : ""}${cfg.tz}h) — starting time sync`,
        );
        startTimeSync(cfg.tz);
      }

      lastConfig = cfg;
      publishState(cfg);
    }
  } catch (err) {
    log.error("Device unreachable:", (err as Error).message);
    publish(AVAILABILITY_TOPIC, "offline", true);
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleLightTube(
  tube: number | "all",
  payload: string,
): Promise<void> {
  const msg = JSON.parse(payload) as LightCommand;
  const cfg = lastConfig;

  // If an effect was requested on all_tubes, map it to a color mode
  if (tube === "all" && msg.effect !== undefined) {
    const m = COLOR_MODE_IDS[msg.effect];
    if (m === undefined) {
      log.warn(`Unknown effect/color mode: ${msg.effect}`);
      return;
    }
    // Preserve current display style (outcarry), default Normal
    const s = cfg?.outcarry ?? 1;
    await setColorMode(m, s);
    return;
  }

  // Base HSV from current state
  let h = 0,
    s = 100,
    v = lastNonZeroV;
  if (cfg) {
    const base = tubeHSV(cfg, tube === "all" ? 1 : tube);
    h = base.h;
    s = base.s;
    // Use lastNonZeroV when device reports 0 (tubes are off)
    v = base.v > 0 ? base.v : lastNonZeroV;
  }

  if (msg.state === "OFF") {
    if (tube === "all") {
      await setAllTubesColor(h, s, 0);
    } else {
      await setTubeColor(tube, h, s, 0);
    }
    return;
  }

  if (msg.color) {
    h = Math.round(msg.color.h);
    s = Math.round(msg.color.s);
  }

  if (msg.brightness !== undefined) {
    v = haBrightToV(msg.brightness);
    if (v > 0) lastNonZeroV = v;
  }

  if (tube === "all") {
    await setAllTubesColor(h, s, v);
  } else {
    await setTubeColor(tube, h, s, v);
  }
}

async function handleTimezone(payload: string): Promise<void> {
  const entry = tzByLabel(payload);
  if (!entry) {
    log.warn(`Unknown timezone label: ${payload}`);
    return;
  }
  await setTimezone(entry.offset);
  log.info(
    `Timezone set to ${entry.label} (offset: ${entry.offset >= 0 ? "+" : ""}${entry.offset}h) — restarting time sync`,
  );
  startTimeSync(entry.offset);
}

async function handleTimeFormat(payload: string): Promise<void> {
  const use24h = payload === "ON";
  await setTimeFormat(use24h);
  log.info(`Time format set to ${use24h ? "24h" : "12h"}`);
}

async function handleAlarm(
  part: "hour" | "minute",
  value: string,
): Promise<void> {
  const n = parseInt(value, 10);
  const h = part === "hour" ? n : (lastConfig?.alarmh ?? 0);
  const m = part === "minute" ? n : (lastConfig?.alarmm ?? 0);
  await setAlarm(h, m);
}

async function handleTimer(payload: string): Promise<void> {
  await setTimer(parseInt(payload, 10));
}

async function handleSyncTime(): Promise<void> {
  const tz = lastConfig?.tz ?? 0;
  log.info(
    `Manual sync — re-arming time sync (offset: ${tz >= 0 ? "+" : ""}${tz}h)`,
  );
  startTimeSync(tz);
  await syncTime(tz);
}

// ── Message router ────────────────────────────────────────────────────────────

client.on("message", async (topic, msg) => {
  // Topic: nixie_clock/<attr>/set
  const parts = topic.split("/");
  const attr = parts[1];
  const payload = msg.toString();

  log.info(`⬅️  HA → ${attr} = ${payload}`);

  try {
    if (attr === "all_tubes") {
      await handleLightTube("all", payload);
    } else if (/^tube_[1-6]$/.test(attr)) {
      await handleLightTube(parseInt(attr.split("_")[1]!), payload);
    } else if (attr === "timezone") {
      await handleTimezone(payload);
    } else if (attr === "time_format") {
      await handleTimeFormat(payload);
    } else if (attr === "alarm_hour") {
      await handleAlarm("hour", payload);
    } else if (attr === "alarm_minute") {
      await handleAlarm("minute", payload);
    } else if (attr === "timer") {
      await handleTimer(payload);
    } else if (attr === "sync_time") {
      await handleSyncTime();
    } else {
      log.warn(`Unknown entity: ${attr}`);
      return;
    }

    // Force-publish state on next poll so HA reflects the change immediately
    forcePollPublish = true;
    void poll();
  } catch (err) {
    log.error(`Command failed for ${attr}:`, (err as Error).message);
  }
});

// ── Firmware sensor ───────────────────────────────────────────────────────────

async function publishFirmware(): Promise<void> {
  try {
    const ver = await getFirmwareVersion();
    MQTT_DEVICE.sw_version = ver;
    publish(`homeassistant/sensor/${MQTT_DEVICE.id}/firmware/state`, ver, true);
    log.info(`Firmware: ${ver}`);
  } catch {
    log.warn("Could not fetch firmware version");
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

log.ok(`Starting Clocteck RGB Tube Clock bridge`);
log.info(`  Device : http://${env.NIXIE_HOST}`);
log.info(`  MQTT   : ${env.MQTT_URL}`);
log.info(`  Poll   : every ${env.POLL_INTERVAL}s`);

await publishFirmware();

setInterval(() => void poll(), env.POLL_INTERVAL * 1000);

process.on("SIGTERM", () => {
  log.info("SIGTERM — shutting down");
  process.exit(0);
});
process.on("SIGINT", () => {
  log.info("SIGINT — shutting down");
  process.exit(0);
});
