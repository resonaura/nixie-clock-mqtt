import "./config.js";
import { env } from "./config.js";
import { createMqttClient, AVAILABILITY_TOPIC } from "./mqtt.js";
import { publishDiscovery } from "./discovery.js";
import { ENTITIES } from "./entities.js";
import {
  getConfig,
  setTubeColor,
  setAllTubesColor,
  setMode,
  setAlarm,
  setTimer,
  setDST,
  setTimezone,
  syncTime,
  getFirmwareVersion,
} from "./nixie.js";
import { LightCommand, MQTTDevice, NixieConfig } from "./types.js";
import {
  log,
  tubeHSV,
  haBrightToV,
  vToHaBright,
  rgbToHsv,
  normalizeValue,
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

// ── MQTT client ───────────────────────────────────────────────────────────────

const client = createMqttClient();

// ── Discovery ─────────────────────────────────────────────────────────────────

client.on("connect", () => {
  log.ok("MQTT connected — publishing discovery…");

  ENTITIES.forEach((e) => publishDiscovery(client, MQTT_DEVICE, e));

  log.ok(
    `Published ${ENTITIES.length} discovery entries for ${MQTT_DEVICE.name}`,
  );

  // Subscribe to all set topics  nixie_clock/+/set
  client.subscribe("nixie_clock/+/set", (err) => {
    if (err) log.error("Subscribe failed:", err.message);
    else log.info("Subscribed to nixie_clock/+/set");
  });

  // Initial poll immediately after connect
  void poll();
});

// ── State publisher ───────────────────────────────────────────────────────────

function publishState(cfg: NixieConfig): void {
  // Per-tube lights
  for (let i = 1; i <= 6; i++) {
    const { h, s, v } = tubeHSV(cfg, i);
    publish(
      `homeassistant/light/${MQTT_DEVICE.id}/tube_${i}/state`,
      JSON.stringify({
        state: v > 0 ? "ON" : "OFF",
        color_mode: "hs",
        color: { h, s },
        brightness: vToHaBright(v),
      }),
    );
  }

  // All-tubes master — uses tube 1 as representative
  {
    const { h, s, v } = tubeHSV(cfg, 1);
    publish(
      `homeassistant/light/${MQTT_DEVICE.id}/all_tubes/state`,
      JSON.stringify({
        state: v > 0 ? "ON" : "OFF",
        color_mode: "hs",
        color: { h, s },
        brightness: vToHaBright(v),
      }),
    );
  }

  // Mode
  publish(
    `homeassistant/select/${MQTT_DEVICE.id}/mode/state`,
    String(normalizeValue("select", "mode", cfg.mode)),
  );

  // Speed (outcarry)
  publish(
    `homeassistant/select/${MQTT_DEVICE.id}/speed/state`,
    String(normalizeValue("select", "speed", cfg.outcarry)),
  );

  // Switches
  publish(
    `homeassistant/switch/${MQTT_DEVICE.id}/time_format/state`,
    cfg.is24h ? "ON" : "OFF",
  );
  publish(
    `homeassistant/switch/${MQTT_DEVICE.id}/dst/state`,
    cfg.dst ? "ON" : "OFF",
  );

  // Numbers
  publish(
    `homeassistant/number/${MQTT_DEVICE.id}/alarm_hour/state`,
    String(cfg.alarmh),
  );
  publish(
    `homeassistant/number/${MQTT_DEVICE.id}/alarm_minute/state`,
    String(cfg.alarmm),
  );
  publish(
    `homeassistant/number/${MQTT_DEVICE.id}/timezone/state`,
    String(cfg.tz),
  );

  log.debug("State published");
}

// ── Polling ───────────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  try {
    const cfg = await getConfig();

    // Publish availability
    publish(AVAILABILITY_TOPIC, "online", true);

    // Only push state if something changed
    if (JSON.stringify(cfg) !== JSON.stringify(lastConfig)) {
      log.info("Config changed — publishing state");
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

  // Resolve base HSV from current state
  let h = 0,
    s = 100,
    v = 100;
  if (cfg) {
    const base = tubeHSV(cfg, tube === "all" ? 1 : tube);
    h = base.h;
    s = base.s;
    v = base.v;
  }

  if (msg.state === "OFF") {
    tube === "all"
      ? await setAllTubesColor(h, s, 0)
      : await setTubeColor(tube, h, s, 0);
    return;
  }

  if (msg.color) {
    h = Math.round(msg.color.h);
    s = Math.round(msg.color.s);
  }

  if (msg.brightness !== undefined) {
    v = haBrightToV(msg.brightness);
  }

  tube === "all"
    ? await setAllTubesColor(h, s, v)
    : await setTubeColor(tube, h, s, v);
}

async function handleMode(payload: string): Promise<void> {
  const m = { Clock: 1, Countdown: 2, Cycle: 3 }[payload];
  if (m === undefined) {
    log.warn(`Unknown mode: ${payload}`);
    return;
  }
  const s = lastConfig?.outcarry ?? 2;
  await setMode(m, s);
}

async function handleSpeed(payload: string): Promise<void> {
  const s = { Slow: 1, Medium: 2, Fast: 3 }[payload];
  if (s === undefined) {
    log.warn(`Unknown speed: ${payload}`);
    return;
  }
  const m = lastConfig?.mode ?? 3;
  await setMode(m, s);
}

async function handleDST(payload: string): Promise<void> {
  await setDST(payload === "ON");
}

async function handleTimeFormat(payload: string): Promise<void> {
  // The clock firmware v3.101 has no confirmed standalone HTTP endpoint for
  // toggling 12/24h from outside the web UI. Log a warning until confirmed.
  log.warn(
    `time_format (${payload}): no confirmed API endpoint in firmware v3.101`,
  );
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

async function handleTimezone(payload: string): Promise<void> {
  await setTimezone(parseInt(payload, 10));
}

async function handleSyncTime(): Promise<void> {
  await syncTime();
}

// ── Message router ────────────────────────────────────────────────────────────

client.on("message", async (topic, msg) => {
  // Topic format: nixie_clock/<attr>/set
  const parts = topic.split("/");
  const attr = parts[1];
  const payload = msg.toString();

  log.info(`⬅️  HA → ${attr} = ${payload}`);

  try {
    if (attr === "all_tubes") {
      await handleLightTube("all", payload);
    } else if (/^tube_[1-6]$/.test(attr)) {
      await handleLightTube(parseInt(attr.split("_")[1]!), payload);
    } else if (attr === "mode") {
      await handleMode(payload);
    } else if (attr === "speed") {
      await handleSpeed(payload);
    } else if (attr === "dst") {
      await handleDST(payload);
    } else if (attr === "time_format") {
      await handleTimeFormat(payload);
    } else if (attr === "alarm_hour") {
      await handleAlarm("hour", payload);
    } else if (attr === "alarm_minute") {
      await handleAlarm("minute", payload);
    } else if (attr === "timer") {
      await handleTimer(payload);
    } else if (attr === "timezone") {
      await handleTimezone(payload);
    } else if (attr === "sync_time") {
      await handleSyncTime();
    } else {
      log.warn(`Unknown entity: ${attr}`);
      return;
    }

    // Re-poll 500ms after command to reflect new state
    setTimeout(() => void poll(), 500);
  } catch (err) {
    log.error(`Command failed for ${attr}:`, (err as Error).message);
  }
});

// ── Firmware sensor (published once on startup) ───────────────────────────────

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

// ── MQTT publish helpers ──────────────────────────────────────────────────────

function publish(topic: string, payload: string, retain = false): void {
  client.publish(topic, payload, { retain, qos: 1 });
}

// ── Start ─────────────────────────────────────────────────────────────────────

log.ok(`Starting Clocteck RGB Tube Clock bridge`);
log.info(`  Device : http://${env.NIXIE_HOST}`);
log.info(`  MQTT   : ${env.MQTT_URL}`);
log.info(`  Poll   : every ${env.POLL_INTERVAL}s`);

await publishFirmware();

setInterval(() => void poll(), env.POLL_INTERVAL * 1000);

// Graceful shutdown
process.on("SIGTERM", () => {
  log.info("SIGTERM — shutting down");
  process.exit(0);
});
process.on("SIGINT", () => {
  log.info("SIGINT — shutting down");
  process.exit(0);
});
