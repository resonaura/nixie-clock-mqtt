#!/usr/bin/with-contenv bashio

CONFIG_PATH=/data/options.json
ENV_FILE="/usr/src/app/.env"

# ── Read MQTT credentials from HA Supervisor (services: mqtt:need) ────────────
if bashio::services.available mqtt; then
  SYSTEM_MQTT_HOST="$(bashio::services mqtt 'host')"
  SYSTEM_MQTT_PORT="$(bashio::services mqtt 'port')"
  SYSTEM_MQTT_USER="$(bashio::services mqtt 'username')"
  SYSTEM_MQTT_PASS="$(bashio::services mqtt 'password')"
  bashio::log.info "🔌 Supervisor MQTT: ${SYSTEM_MQTT_HOST}:${SYSTEM_MQTT_PORT}"
else
  bashio::log.warning "⚠️  Supervisor MQTT service not available, falling back to manual config"
fi

# ── Read user options from options.json ───────────────────────────────────────
NIXIE_HOST=$(jq -r '.nixie_host'    $CONFIG_PATH)
POLL_INTERVAL=$(jq -r '.poll_interval' $CONFIG_PATH)
USER_MQTT_URL=$(jq -r '.mqtt_url  // empty' $CONFIG_PATH)
USER_MQTT_USER=$(jq -r '.mqtt_user // empty' $CONFIG_PATH)
USER_MQTT_PASS=$(jq -r '.mqtt_pass // empty' $CONFIG_PATH)
LOG_LEVEL=$(jq -r '.log_level'     $CONFIG_PATH)

# ── Resolve final MQTT connection ─────────────────────────────────────────────
if [ -n "$USER_MQTT_URL" ]; then
  MQTT_URL="$USER_MQTT_URL"
else
  MQTT_URL="mqtt://${SYSTEM_MQTT_HOST:-core-mosquitto}:${SYSTEM_MQTT_PORT:-1883}"
fi

if [ -n "$USER_MQTT_USER" ]; then
  MQTT_USER="$USER_MQTT_USER"
  MQTT_PASS="$USER_MQTT_PASS"
else
  MQTT_USER="${SYSTEM_MQTT_USER:-}"
  MQTT_PASS="${SYSTEM_MQTT_PASS:-}"
fi

# ── Write .env ─────────────────────────────────────────────────────────────────
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
NIXIE_HOST=${NIXIE_HOST}
POLL_INTERVAL=${POLL_INTERVAL}
MQTT_URL=${MQTT_URL}
MQTT_USER=${MQTT_USER}
MQTT_PASS=${MQTT_PASS}
LOG_LEVEL=${LOG_LEVEL}
EOF

bashio::log.info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bashio::log.info " Clocteck RGB Tube Clock — MQTT Bridge"
bashio::log.info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bashio::log.info " Device : http://${NIXIE_HOST}"
bashio::log.info " MQTT   : ${MQTT_URL}"
bashio::log.info " Poll   : every ${POLL_INTERVAL}s"
bashio::log.info " Log    : ${LOG_LEVEL}"
bashio::log.info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exec node /usr/src/app/dist/index.js
