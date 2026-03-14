import { MqttClient } from "mqtt";
import { EntityConfig, MQTTDevice } from "./types.js";
import { AVAILABILITY_TOPIC } from "./mqtt.js";

const DEVICE_BASE_TOPIC = "nixie_clock";

export function topicBase(
  device: MQTTDevice,
  attr: string,
  domain: string,
): string {
  return `homeassistant/${domain}/${device.id}/${attr}`;
}

function publishDiscoveryEntity(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
  overrides: Record<string, unknown> = {},
): void {
  const base = topicBase(device, entity.attr, entity.domain);

  const payload: Record<string, unknown> = {
    name: entity.name,
    unique_id: `${device.id}_${entity.attr}`,
    object_id: `nixie_${entity.attr}`,
    icon: entity.icon,
    availability_topic: AVAILABILITY_TOPIC,
    device: {
      identifiers: device.identifiers,
      manufacturer: device.manufacturer,
      model: device.model,
      name: device.name,
      sw_version: device.sw_version,
    },
    ...overrides,
  };

  // State topic for everything except button
  if (entity.domain !== "button") {
    payload.state_topic = `${base}/state`;
  }

  // Command topic for writable entities
  if (entity.command) {
    payload.command_topic = `${DEVICE_BASE_TOPIC}/${entity.attr}/set`;
  }

  if (entity.entityCategory) {
    payload.entity_category = entity.entityCategory;
  }

  client.publish(`${base}/config`, JSON.stringify(payload), { retain: true });
}

// ── Domain-specific discovery publishers ─────────────────────────────────────

export function publishLightDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  const overrides: Record<string, unknown> = {
    schema: "json",
    brightness: true,
    color_mode: true,
    supported_color_modes: ["hs"],
    brightness_scale: 255,
  };

  if (entity.effects && entity.effects.length > 0) {
    overrides.effect = true;
    overrides.effect_list = entity.effects;
  }

  publishDiscoveryEntity(client, device, entity, overrides);
}

export function publishSelectDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  publishDiscoveryEntity(client, device, entity, {
    options: entity.options ?? [],
  });
}

export function publishSwitchDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  publishDiscoveryEntity(client, device, entity, {
    payload_on: "ON",
    payload_off: "OFF",
  });
}

export function publishNumberDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  publishDiscoveryEntity(client, device, entity, {
    min: entity.min ?? 0,
    max: entity.max ?? 100,
    step: entity.step ?? 1,
    unit_of_measurement: entity.unit,
    mode: "box",
  });
}

export function publishButtonDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  publishDiscoveryEntity(client, device, entity, {
    payload_press: "PRESS",
  });
}

export function publishSensorDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  publishDiscoveryEntity(client, device, entity, {
    unit_of_measurement: entity.unit,
    device_class: entity.deviceClass,
  });
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function publishDiscovery(
  client: MqttClient,
  device: MQTTDevice,
  entity: EntityConfig,
): void {
  switch (entity.domain) {
    case "light":
      publishLightDiscovery(client, device, entity);
      break;
    case "select":
      publishSelectDiscovery(client, device, entity);
      break;
    case "switch":
      publishSwitchDiscovery(client, device, entity);
      break;
    case "number":
      publishNumberDiscovery(client, device, entity);
      break;
    case "button":
      publishButtonDiscovery(client, device, entity);
      break;
    case "sensor":
      publishSensorDiscovery(client, device, entity);
      break;
  }
}
