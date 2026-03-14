import mqtt, { MqttClient } from "mqtt";
import { env } from "./config.js";

export const AVAILABILITY_TOPIC = "nixie_clock/availability";

export function createMqttClient(): MqttClient {
  const client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USER || undefined,
    password: env.MQTT_PASS || undefined,
    will: {
      topic: AVAILABILITY_TOPIC,
      payload: "offline",
      retain: true,
      qos: 1,
    },
    reconnectPeriod: 5_000,
    clean: true,
  });

  client.on("connect", () => console.log("✅ MQTT connected"));
  client.on("reconnect", () => console.log("🔄 MQTT reconnecting…"));
  client.on("offline", () => console.warn("⚠️  MQTT offline"));
  client.on("error", (err) => console.error("❌ MQTT error:", err.message));

  return client;
}
