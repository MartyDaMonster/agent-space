import { presetById } from "./avatar-presets.js";

export function resolveAvatar({ preset, required }) {
  if (!preset) {
    if (!required) return { ok: true, skipped: true };
    return { ok: false, error: "Pick an avatar." };
  }
  const chosen = presetById(preset);
  if (!chosen) return { ok: false, error: "Pick an avatar." };
  return { ok: true, url: chosen.src, avatar: chosen.id };
}
