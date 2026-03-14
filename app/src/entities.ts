import { EntityConfig } from "./types.js";
import { COLOR_MODE_OPTIONS, TIMEZONE_LABELS } from "./types.js";

export const ENTITIES: EntityConfig[] = [
  // ── Per-tube lights ──────────────────────────────────────────────────────
  {
    domain: "light",
    name: "All Tubes",
    attr: "all_tubes",
    icon: "mdi:clock-digital",
    command: true,
    effects: COLOR_MODE_OPTIONS,
  },
  {
    domain: "light",
    name: "Tube 1",
    attr: "tube_1",
    icon: "mdi:numeric-1-box-outline",
    command: true,
  },
  {
    domain: "light",
    name: "Tube 2",
    attr: "tube_2",
    icon: "mdi:numeric-2-box-outline",
    command: true,
  },
  {
    domain: "light",
    name: "Tube 3",
    attr: "tube_3",
    icon: "mdi:numeric-3-box-outline",
    command: true,
  },
  {
    domain: "light",
    name: "Tube 4",
    attr: "tube_4",
    icon: "mdi:numeric-4-box-outline",
    command: true,
  },
  {
    domain: "light",
    name: "Tube 5",
    attr: "tube_5",
    icon: "mdi:numeric-5-box-outline",
    command: true,
  },
  {
    domain: "light",
    name: "Tube 6",
    attr: "tube_6",
    icon: "mdi:numeric-6-box-outline",
    command: true,
  },

  // ── Time ─────────────────────────────────────────────────────────────────

  {
    domain: "select",
    name: "Timezone",
    attr: "timezone",
    icon: "mdi:earth",
    command: true,
    options: TIMEZONE_LABELS,
  },
  {
    domain: "switch",
    name: "24h Time Format",
    attr: "time_format",
    icon: "mdi:clock-time-four-outline",
    command: true,
  },
  {
    domain: "button",
    name: "Sync Time",
    attr: "sync_time",
    icon: "mdi:clock-check-outline",
    command: true,
  },

  // ── Alarm ────────────────────────────────────────────────────────────────
  {
    domain: "number",
    name: "Alarm Hour",
    attr: "alarm_hour",
    icon: "mdi:alarm",
    command: true,
    unit: "h",
    min: 0,
    max: 23,
    step: 1,
  },
  {
    domain: "number",
    name: "Alarm Minute",
    attr: "alarm_minute",
    icon: "mdi:alarm",
    command: true,
    unit: "min",
    min: 0,
    max: 59,
    step: 1,
  },

  // ── Timer ────────────────────────────────────────────────────────────────
  {
    domain: "number",
    name: "Countdown Timer",
    attr: "timer",
    icon: "mdi:timer-outline",
    command: true,
    unit: "min",
    min: 0,
    max: 99,
    step: 1,
  },

  // ── Diagnostics ──────────────────────────────────────────────────────────
  {
    domain: "sensor",
    name: "Firmware Version",
    attr: "firmware",
    icon: "mdi:chip",
    command: false,
    entityCategory: "diagnostic",
  },
];
