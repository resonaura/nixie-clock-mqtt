import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLightCommand,
  rememberLightCommand,
} from "../src/light-command.js";
import type { NixieConfig } from "../src/types.js";
const config = () =>
  ({ mode: 1, outcarry: 1, light: 18, h1: 0, s1: 254 }) as NixieConfig;
test("saved Custom scenes apply colour and brightness together", () => {
  const cfg = config();
  const result = resolveLightCommand(
    { state: "ON", effect: "Custom", color: { h: 31, s: 95 }, brightness: 61 },
    cfg,
    "all",
    7,
  );
  assert.deepEqual(result, {
    h: 31,
    s: 95,
    v: 24,
    mode: 1,
    effect: "Custom",
    writeColor: true,
  });
  rememberLightCommand(cfg, "all", result);
  for (let tube = 1; tube <= 6; tube++) assert.equal(cfg[`h${tube}`], 31);
  assert.equal(cfg.light, 61);
  assert.equal(resolveLightCommand({ state: "ON" }, cfg, "all", 7).v, 24);
});
test("explicit animation is not silently replaced by Custom when a scene also carries colour", () => {
  assert.equal(
    resolveLightCommand(
      { effect: "Rainbow", color: { h: 120, s: 100 }, brightness: 120 },
      config(),
      "all",
      7,
    ).mode,
    2,
  );
  assert.equal(
    resolveLightCommand(
      { color: { h: 120, s: 100 } },
      { ...config(), mode: 2 },
      "all",
      7,
    ).mode,
    1,
  );
  assert.equal(
    resolveLightCommand({ color: { h: 120, s: 100 } }, null, "all", 7).mode,
    1,
  );
});
test("OFF wins over effect-only handling and ON restores the remembered level", () => {
  const cfg = { ...config(), light: 0 };
  assert.equal(
    resolveLightCommand({ state: "OFF", effect: "Custom" }, cfg, "all", 24).v,
    0,
  );
  assert.equal(
    resolveLightCommand({ state: "OFF", effect: "Custom" }, cfg, "all", 24)
      .writeColor,
    true,
  );
  assert.equal(
    resolveLightCommand({ state: "ON", effect: "Custom" }, cfg, "all", 24).v,
    24,
  );
  const effectOnly = resolveLightCommand({ effect: "Custom" }, cfg, "all", 24);
  assert.equal(effectOnly.v, 0);
  assert.equal(effectOnly.writeColor, false);
});
test("tube commands preserve the other tubes and invalid scenes never reach hardware", () => {
  const cfg = config();
  rememberLightCommand(
    cfg,
    2,
    resolveLightCommand(
      { rgb_color: [125, 82, 255], brightness: 3 },
      cfg,
      2,
      7,
    ),
  );
  assert.equal(cfg.h1, 0);
  assert.equal(cfg.h2, 255);
  assert.equal(cfg.light, 3);
  assert.throws(() => resolveLightCommand({ effect: "bogus" }, cfg, "all", 7));
  assert.throws(() => resolveLightCommand({ brightness: NaN }, cfg, "all", 7));
  assert.throws(() =>
    resolveLightCommand({ color: { h: NaN, s: 100 } }, cfg, "all", 7),
  );
});
