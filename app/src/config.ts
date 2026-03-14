import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),

  // Clock
  NIXIE_HOST: z.string().default("192.168.5.108"),

  // MQTT
  MQTT_URL: z.string().url().default("mqtt://localhost:1883"),
  MQTT_USER: z.string().default(""),
  MQTT_PASS: z.string().default(""),

  // General
  POLL_INTERVAL: z.coerce.number().min(1).max(60).default(10), // seconds
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
