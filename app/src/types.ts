// ── Nixie Clock HTTP API ──────────────────────────────────────────────────────

/** Raw response from GET /config */
export interface NixieConfig {
  h1: number;
  s1: number;
  h2: number;
  s2: number;
  h3: number;
  s3: number;
  h4: number;
  s4: number;
  h5: number;
  s5: number;
  h6: number;
  s6: number;
  alarmh: number;
  alarmm: number;
  /** 1 = Clock, 2 = Countdown, 3 = Cycle */
  mode: number;
  /** 0 = 12h, 1 = 24h */
  is24h: number;
  /** cycle speed: 1 = Slow, 2 = Medium, 3 = Fast */
  outcarry: number;
  /** global backlight level 0–254 */
  light: number;
  tz: number;
  /** 0 = off, 1 = on */
  dst: number;
  mypassword: string;
}

// ── MQTT Discovery ────────────────────────────────────────────────────────────

export type EntityDomain =
  | "light"
  | "select"
  | "switch"
  | "number"
  | "button"
  | "sensor";

export interface EntityConfig {
  domain: EntityDomain;
  /** Human-readable label shown in HA */
  name: string;
  /** Unique slug used in MQTT topic path and object_id */
  attr: string;
  icon: string;
  /** Whether HA can send commands to this entity */
  command: boolean;
  unit?: string;
  deviceClass?: string;
  entityCategory?: "diagnostic" | "config";
  /** For select entities */
  options?: string[];
  /** For number entities */
  min?: number;
  max?: number;
  step?: number;
}

// ── Internal state ────────────────────────────────────────────────────────────

export interface NixieState {
  config: NixieConfig;
  online: boolean;
}

// ── HA MQTT light command payload (JSON schema) ───────────────────────────────

export interface LightCommand {
  state?: "ON" | "OFF";
  brightness?: number;
  color?: { h: number; s: number };
}

// ── MQTT device descriptor (reused in all discovery payloads) ─────────────────

export interface MQTTDevice {
  identifiers: string[];
  manufacturer: string;
  model: string;
  name: string;
  sw_version: string;
  /** Used as the middle segment in discovery topics */
  id: string;
}
