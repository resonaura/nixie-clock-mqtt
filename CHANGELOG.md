# Changelog

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