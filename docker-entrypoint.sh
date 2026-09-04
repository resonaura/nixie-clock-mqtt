#!/usr/bin/env bash
set -e

echo "🚀 Running Clocteck RGB Tube Clock in standalone Docker mode..."
echo "  Device : http://${NIXIE_HOST:-192.168.5.108}"
echo "  MQTT   : ${MQTT_URL:-mqtt://localhost:1883}"

exec node /usr/src/app/dist/index.js
