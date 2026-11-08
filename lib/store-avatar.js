import { colorById, shapeById } from "./avatar-presets.js";

export function resolveAvatar({ shape, color, required }) {
  if (!shape && !color) {
    if (!required) return { ok: true, skipped: true };
    return { ok: false, error: "Pick a shape and a colour." };
  }
  if (!shapeById(shape) || !colorById(color)) {
    return { ok: false, error: "Pick a shape and a colour." };
  }
  return { ok: true, shape, color, avatar: shape, url: null };
}
