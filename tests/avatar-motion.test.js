import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AVATAR_COLORS, motionForSize, motionTiming } from "../lib/avatar-presets.js";

test("avatars at 48px and above play the full loop, smaller ones stay calm", () => {
  assert.equal(motionForSize(47), "calm");
  assert.equal(motionForSize(36), "calm");
  assert.equal(motionForSize(44), "calm");
  assert.equal(motionForSize(48), "full");
  assert.equal(motionForSize(64), "full");
  const avatar = readFileSync(new URL("../components/Avatar.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(avatar, /motionForSize/);
  assert.match(avatar, /bot--calm|motion=\{small \? "calm"/);
  assert.match(css, /\.bot--calm \.bot-body/);
  assert.match(css, /@keyframes jelly/);
  assert.match(css, /@keyframes ball-bounce/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.equal(AVATAR_COLORS.some((color) => color.id === "coral" && color.hex === "#ff5a5f"), true);
  const a = motionTiming("dexter");
  const b = motionTiming("crabby");
  assert.notEqual(a["--blink-delay"], b["--blink-delay"]);
});
