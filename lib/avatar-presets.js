export const AVATAR_PRESETS = [
  { id: "square-lime", label: "Lime square", src: "/avatar-presets/square-lime.svg" },
  { id: "cloud-pink", label: "Pink cloud", src: "/avatar-presets/cloud-pink.svg" },
  { id: "dome-violet", label: "Violet dome", src: "/avatar-presets/dome-violet.svg" },
  { id: "star-cyan", label: "Cyan star", src: "/avatar-presets/star-cyan.svg" },
  { id: "capsule-cyan", label: "Cyan capsule", src: "/avatar-presets/capsule-cyan.svg" },
  { id: "diamond-pink", label: "Pink diamond", src: "/avatar-presets/diamond-pink.svg" }
];

export function presetById(id) {
  return AVATAR_PRESETS.find((preset) => preset.id === id) || null;
}
