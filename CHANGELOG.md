# Changelog

## v1.1.0 — Time Sync, Richer Controls & Bug Fixes

### ✨ Features

- **Continuous time sync** — new `timesync.ts` module pushes `/uptm` every second using UTC math + the configured timezone offset; clock no longer drifts between manual syncs
- **Timezone select** — timezone is now a `select` entity with 25 labelled options (UTC−12 to UTC+12, including UTC+5:30 for India); labels match the firmware web UI exactly, replacing the raw number input
- **Color Mode select** — new `select` entity: `Custom` / `Rainbow` / `Breathing` / `Flowing` / `Test`, mapping to firmware `m=1..5`; replaces the old "Display mode" entity
- **Display Style select** — new `select` entity: `Normal` / `Carry` / `Jumping`, mapping to firmware `s=1..3`; only applies in `Custom` colour mode; replaces the old "Cycle speed" entity
- **Timesync auto-restart on timezone change** — changing the timezone (via config poll or manual MQTT command) automatically restarts the timesync loop so the new offset takes effect immediately

### 🐛 Bug Fixes

- **Correct brightness formula** — brightness was incorrectly calculated as `s / 254 * 100`; now uses `light / 2.55` to match the firmware's own JavaScript source
- **Number entities use `mode: box`** — alarm hour, alarm minute, and countdown timer entities now render as a numeric input box in HA instead of a slider

### ⚙️ Improvements

- **Poll interval default changed** from 10 s → 1 s; change detection ensures no redundant MQTT publishes despite the higher poll rate

### 🔧 Breaking Changes

The following entities have been renamed or replaced. Any HA automations, dashboards, or scripts that reference the old entity IDs will need to be updated.

| Old entity | Old type | New entity | New type |
|---|---|---|---|
| `select.nixie_mode` (Display mode) | `select` | `select.nixie_color_mode` (Color Mode) | `select` |
| `select.nixie_speed` (Cycle speed) | `select` | `select.nixie_display_style` (Display Style) | `select` |
| `number.nixie_timezone` (Timezone offset) | `number` | `select.nixie_timezone` (Timezone) | `select` |

---

## v1.0.0 — Initial Release

### ✨ Features

- Full MQTT bridge for **Clocteck RGB Tube Clock** (firmware v3.101)
- **Home Assistant MQTT Discovery** — all entities appear in HA automatically, zero manual YAML
- **Per-tube colour control** — 6 individual `light` entities (HSV, brightness)
- **All-tubes master** — single `light` entity to set all 6 tubes at once
- **Display mode** — `select` entity: `Clock` / `Countdown` / `Cycle`
- **Cycle speed** — `select` entity: `Slow` / `Medium` / `Fast`
- **Alarm** — `number` entities for hour (0–23) and minute (0–59)
- **Countdown timer** — `number` entity (0–99 minutes, 0 = stop)
- **DST toggle** — `switch` entity
- **Timezone offset** — `number` entity (−12 to +14)
- **Sync Time** — `button` entity that pushes current system time to the clock
- **Firmware version** — diagnostic `sensor`
- Polling `/config` every N seconds with change detection (no redundant publishes)
- Graceful `offline` LWT when bridge disconnects
- `services: mqtt:need` — auto-reads broker credentials from HA Supervisor (no manual MQTT config needed)
- `docker compose` support for running outside of HA
- `.env` based config for local dev with `tsx` watch mode