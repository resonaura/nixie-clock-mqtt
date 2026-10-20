import {
  COLOR_MODE_IDS,
  COLOR_MODE_NAMES,
  type LightCommand,
  type NixieConfig,
} from "./types.js";

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
const finite = (values: unknown[], size: number): values is number[] =>
  values.length === size &&
  values.every((value) => typeof value === "number" && Number.isFinite(value));

/** Resolve a whole scene command before making any HTTP request to the clock. */
export function resolveLightCommand(
  msg: LightCommand,
  cfg: NixieConfig | null,
  tube: number | "all",
  lastNonZeroV: number,
) {
  const index = tube === "all" ? 1 : tube;
  let h = cfg?.[`h${index}`] ?? 0;
  let s = cfg ? Math.round(Number(cfg[`s${index}`]) / 2.55) : 100;
  const previousV = cfg ? Math.round(cfg.light / 2.55) : 0;
  let v = previousV > 0 ? previousV : lastNonZeroV || 100;
  let explicitColor = false;
  const hs = msg.color ? [msg.color.h, msg.color.s] : msg.hs_color;
  const rgb = msg.color
    ? [msg.color.r, msg.color.g, msg.color.b]
    : msg.rgb_color;
  if (hs && finite(hs, 2)) {
    [h, s] = [clamp(hs[0], 360), clamp(hs[1], 100)];
    explicitColor = true;
  } else if (rgb && finite(rgb, 3)) {
    const [r, g, b] = rgb.map((value) => clamp(value, 255) / 255);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min;
    h =
      delta === 0
        ? 0
        : ((max === r
            ? (g - b) / delta
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4) *
            60 +
            360) %
          360;
    s = max ? (delta / max) * 100 : 0;
    explicitColor = true;
  }
  if ((msg.color || msg.hs_color || msg.rgb_color) && !explicitColor)
    throw new Error("Invalid light colour");
  if (msg.brightness !== undefined) {
    if (!Number.isFinite(msg.brightness))
      throw new Error("Invalid light brightness");
    v =
      msg.brightness <= 0
        ? 0
        : Math.max(1, Math.round((clamp(msg.brightness, 255) / 255) * 100));
  }
  if (msg.state === "OFF") v = 0;
  const effectMode =
    tube === "all" && msg.effect !== undefined
      ? COLOR_MODE_IDS[msg.effect]
      : undefined;
  if (tube === "all" && msg.effect !== undefined && effectMode === undefined)
    throw new Error("Unknown light effect");
  // Saved scenes include both effect and colour. An explicit animation is authoritative;
  // only implicit static-colour requests should switch an animation to Custom.
  const mode = effectMode ?? (explicitColor && cfg?.mode !== 1 ? 1 : undefined);
  const writeColor =
    explicitColor || msg.brightness !== undefined || msg.state !== undefined;
  return {
    h: Math.round(h),
    s: Math.round(s),
    v: writeColor ? v : previousV,
    mode,
    effect: COLOR_MODE_NAMES[mode ?? cfg?.mode ?? 1],
    writeColor,
  };
}

/** Keep follow-up commands from restoring the pre-scene colour or brightness. */
export function rememberLightCommand(
  cfg: NixieConfig | null,
  tube: number | "all",
  command: ReturnType<typeof resolveLightCommand>,
): void {
  if (!cfg) return;
  if (command.mode !== undefined) cfg.mode = command.mode;
  if (!command.writeColor) return;
  cfg.light = Math.min(254, Math.round(command.v * 2.55));
  for (const index of tube === "all" ? [1, 2, 3, 4, 5, 6] : [tube]) {
    cfg[`h${index}`] = command.h;
    cfg[`s${index}`] = Math.min(254, Math.round(command.s * 2.55));
  }
}
