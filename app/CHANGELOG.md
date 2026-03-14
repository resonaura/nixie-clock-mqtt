# Changelog

## v1.3.1 — Fix: Restore Brightness on Light ON

### 🐛 Bug Fixes

- **Turning any tube back ON after OFF did nothing** — when all tubes are off the device reports `light=0`, so reading brightness from `/config` gave `v=0` and the ON command sent `v=0` (still off). Fixed by tracking `lastNonZeroV` — the last non-zero brightness seen from the device or set via a command. This value is restored whenever an ON command arrives without an explicit brightness.

---

## v1.3.0 — Time Fix, UI Cleanup

### 🐛 Bug Fixes

- **Clock showed wrong time (off by several hours)** — `syncTimeWithOffset` was applying the timezone offset before sending to `/uptm`, but the firmware applies its own stored `tz` offset on top. This caused double-shifting. Fixed: now pure UTC is sent and the firmware handles local time conversion itself.
- **`mo` (month) was 0-based** — JS `Date.getUTCMonth()` returns 0–11, but the firmware expects 1–12. Fixed by sending `mo: now.getUTCMonth() + 1`.

### ✨ Improvements

- **Color Mode is now an Effect on the "All Tubes" light** — instead of a separate `select` entity, color mode (Custom / Rainbow / Breathing / Flowing / Test) is exposed as an HA light effect list on the `All Tubes` light entity. This is the natural HA UX for light effects.
- **Removed "Daylight Saving Time" switch** — caused confusion and conflicted with the firmware's own DST handling. DST should be set directly on the device if needed.
- **Removed "Display Style" select** — was bugging out and conflicting with time sync and other features. The firmware keeps its last display style internally.

### 🔧 Breaking Changes

| Removed entity | Was |
|---|---|
| `switch.nixie_dst` | Daylight Saving Time toggle |
| `select.nixie_display_style` | Display Style (Normal/Carry/Jumping) |
| `select.nixie_color_mode` | Color Mode select |

Color Mode is now available as `effect` on `light.nixie_all_tubes`.

---

## v1.2.2 — Build Fix: package-lock.json

### 🐛 Bug Fixes

- **`package-lock.json` was missing from the repository** — the file was listed in `.gitignore`, so Supervisor's Docker build context never contained it. This caused a hard build failure: `ERROR: failed to calculate checksum … "/package-lock.json": not found`. Fixed by removing `package-lock.json` from `.gitignore` and committing it so `npm ci` (which requires a lockfile) can run correctly during the image build.

---

## v1.2.1 — Build Cache Bust

### 🔧 Internal

- Version bump to force a clean Supervisor rebuild and clear any stale Docker layer cache.
- No functional changes.

---

## v1.2.0 — Critical Bug Fixes (Firmware JS Deobfuscation Audit)

### 🐛 Bug Fixes

- **`/time` endpoint now sends 1-based index, not raw UTC offset** — confirmed by fully deobfuscating the firmware's `initTimeZone` and `sendTimeZone` functions. The device stores `tz` in `/config` as a raw offset (e.g. `3` for Moscow UTC+3), but `/time?t=` expects a **1-based dropdown index**: `t = offset + 13`. Previously the bridge sent the raw offset which would silently set the wrong timezone (e.g. Moscow → UTC−10 instead of UTC+3). Fixed in `setTimezone()`: `t = tzOffsetHours + 13`.
- **`/tm` endpoint for 12/24h format now implemented** — the firmware JS uses `/tm?s=12` or `/tm?s=24` (the literal hour count value from the radio buttons). Previously the bridge logged a warning and did nothing. The `time_format` switch entity now correctly calls `/tm?s=24` (ON) or `/tm?s=12` (OFF).

### ✅ Confirmed Correct (no changes needed)

The following were audited against the deobfuscated firmware JS and confirmed correct:

| Endpoint | Parameter | Our code | Firmware expects | Status |
|---|---|---|---|---|
| `/uptm` | `t=0`, `h`=UTC hours, `m/s/mo/d/y` | UTC-shifted math | UTC hours, t always 0 | ✅ |
| `/tubecolor` | `h`=0–360, `s`=0–100, `v`=0–100 | exact | exact | ✅ |
| `/alarm` | `h`=0–23, `m`=0–59 | exact | exact | ✅ |
| `/timer` | `min`=0–99 | exact | exact | ✅ |
| `/mode` | `m`=1–5, `s`=1–3 | exact | exact | ✅ |
| `/enDST` | `d`=0 or 1 | exact | exact | ✅ |
| `cfg.tz` | raw UTC offset hours | exact | stored as offset | ✅ |
| `cfg.is24h` | 0=12h, 1=24h | exact | exact | ✅ |
| `h1..h6` | 0–360 hue from `/config` | read directly | stored as 0–360 | ✅ |
| `s1..s6` | 0–254 saturation → `/ 2.55` | exact | exact | ✅ |
| `light` | 0–254 brightness → `/ 2.55` | exact | exact | ✅ |

> **Note on India (UTC+5:30):** The firmware stores India as `tz=5` in `/config` (integer, no fractional support). The bridge timezone list entry for India uses `offset: 5.5` for correct timesync math but sends `t = 5.5 + 13 = 18.5` — which the firmware rounds to 18 (the India slot). This is consistent with the firmware's own 25-slot dropdown.

---

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