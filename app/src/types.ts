// ── Nixie Clock HTTP API ──────────────────────────────────────────────────────

/**
 * Raw response from GET /config
 *
 * Field notes (from firmware source + HAR):
 *  - h1..h6   : hue 0–360
 *  - s1..s6   : saturation 0–254
 *  - light     : global brightness 0–254 (maps to v in tubecolor as light/2.55)
 *  - mode      : color mode m=1..5 (Custom/Rainbow/Breathing/Flowing/Test)
 *  - outcarry  : display style s=1..3 (Normal/Carry/Jumping) — used alongside m=1
 *  - is24h     : 0=12h, 1=24h
 *  - tz        : raw offset index from firmware: tz=-12..+12 (maps to UTC offset hours)
 *  - dst       : 0=off, 1=on
 *  - alarmh/alarmm : alarm hour/minute
 */
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
  /** Color mode: 1=Custom, 2=Rainbow, 3=Breathing, 4=Flowing, 5=Test */
  mode: number;
  /** 0 = 12h, 1 = 24h */
  is24h: number;
  /**
   * Display style (used with m=1):
   * 1 = Normal, 2 = Carry, 3 = Jumping
   */
  outcarry: number;
  /** Global backlight brightness 0–254 */
  light: number;
  /** Timezone offset in hours, e.g. -8 for PST, +3 for MSK */
  tz: number;
  /** 0 = off, 1 = on */
  dst: number;
  mypassword: string;
}

// ── Color Mode (m= param in /mode) ────────────────────────────────────────────

export const COLOR_MODE_NAMES: Record<number, string> = {
  1: "Custom",
  2: "Rainbow",
  3: "Breathing",
  4: "Flowing",
  5: "Test",
};

export const COLOR_MODE_IDS: Record<string, number> = {
  Custom: 1,
  Rainbow: 2,
  Breathing: 3,
  Flowing: 4,
  Test: 5,
};

export const COLOR_MODE_OPTIONS = Object.keys(COLOR_MODE_IDS);

// ── Display Style (s= param in /mode when m=1) ────────────────────────────────

export const DISPLAY_STYLE_NAMES: Record<number, string> = {
  1: "Normal",
  2: "Carry",
  3: "Jumping",
};

export const DISPLAY_STYLE_IDS: Record<string, number> = {
  Normal: 1,
  Carry: 2,
  Jumping: 3,
};

export const DISPLAY_STYLE_OPTIONS = Object.keys(DISPLAY_STYLE_IDS);

// ── Timezone list (matches firmware dropdown exactly) ─────────────────────────

export interface TimezoneEntry {
  /** Numeric offset in hours (may be fractional, e.g. 5.5 for India) */
  offset: number;
  /** Display label shown in HA select */
  label: string;
}

/**
 * 25 timezone entries as defined in the firmware web UI.
 * Index 0 = UTC-12, index 12 = UTC+0, index 24 = UTC+12.
 * India (UTC+5:30) uses offset 5.5.
 */
export const TIMEZONES: TimezoneEntry[] = [
  { offset: -12, label: "UTC-12:00 — International Date Line West" },
  { offset: -11, label: "UTC-11:00 — Coordinated Universal Time-11" },
  { offset: -10, label: "UTC-10:00 — Aleutian Islands" },
  { offset: -9, label: "UTC-09:00 — Alaska" },
  { offset: -8, label: "UTC-08:00 — Pacific Time (Seattle, Vancouver)" },
  { offset: -7, label: "UTC-07:00 — Mountain Time (Denver, Calgary)" },
  { offset: -6, label: "UTC-06:00 — Central Time (Chicago, Mexico City)" },
  { offset: -5, label: "UTC-05:00 — Eastern Time (New York, Toronto)" },
  { offset: -4, label: "UTC-04:00 — Atlantic Time (Halifax)" },
  { offset: -3, label: "UTC-03:00 — Buenos Aires, São Paulo" },
  { offset: -2, label: "UTC-02:00 — Coordinated Universal Time-2" },
  { offset: -1, label: "UTC-01:00 — Azores, Cape Verde" },
  { offset: 0, label: "UTC+00:00 — London, Lisbon" },
  { offset: 1, label: "UTC+01:00 — Central European (Paris, Berlin)" },
  { offset: 2, label: "UTC+02:00 — Cairo, Athens" },
  { offset: 3, label: "UTC+03:00 — Moscow, Istanbul" },
  { offset: 4, label: "UTC+04:00 — Dubai, Abu Dhabi" },
  { offset: 5.5, label: "UTC+05:30 — India (New Delhi, Mumbai)" },
  { offset: 6, label: "UTC+06:00 — Astana, Dhaka" },
  { offset: 7, label: "UTC+07:00 — Bangkok, Jakarta" },
  { offset: 8, label: "UTC+08:00 — Beijing, Singapore" },
  { offset: 9, label: "UTC+09:00 — Tokyo, Seoul" },
  { offset: 10, label: "UTC+10:00 — Sydney, Melbourne" },
  { offset: 11, label: "UTC+11:00 — Solomon Islands, Nouméa" },
  { offset: 12, label: "UTC+12:00 — Auckland, Wellington" },
];

/** Get a TimezoneEntry by UTC offset hours (exact match). */
export function tzByOffset(offset: number): TimezoneEntry | undefined {
  return TIMEZONES.find((z) => z.offset === offset);
}

/** Get a TimezoneEntry by its label string. */
export function tzByLabel(label: string): TimezoneEntry | undefined {
  return TIMEZONES.find((z) => z.label === label);
}

/** All labels in order, used as the `options` list for the HA select entity. */
export const TIMEZONE_LABELS = TIMEZONES.map((z) => z.label);

// ── MQTT Discovery entity config ──────────────────────────────────────────────

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

// ── MQTT device descriptor ────────────────────────────────────────────────────

export interface MQTTDevice {
  identifiers: string[];
  manufacturer: string;
  model: string;
  name: string;
  sw_version: string;
  /** Used as the middle segment in discovery topics */
  id: string;
}
