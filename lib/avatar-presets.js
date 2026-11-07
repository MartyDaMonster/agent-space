export const DEFAULT_PRESET_ID = "cloud-pink";

export const AVATAR_PRESETS = [
  { id: "square-lime", label: "Lime square", src: "/avatar-presets/square-lime.svg" },
  { id: "cloud-pink", label: "Pink cloud", src: "/avatar-presets/cloud-pink.svg" },
  { id: "dome-violet", label: "Violet dome", src: "/avatar-presets/dome-violet.svg" },
  { id: "star-cyan", label: "Cyan star", src: "/avatar-presets/star-cyan.svg" },
  { id: "capsule-cyan", label: "Cyan capsule", src: "/avatar-presets/capsule-cyan.svg" },
  { id: "diamond-pink", label: "Pink diamond", src: "/avatar-presets/diamond-pink.svg" },
  { id: "crab-cyan", label: "Crab", src: "/avatar-presets/crab-cyan.svg" },
  { id: "sheep-lime", label: "Sheep", src: "/avatar-presets/sheep-lime.svg" },
  { id: "sun-lime", label: "Sun", src: "/avatar-presets/sun-lime.svg" },
  { id: "moon-violet", label: "Moon", src: "/avatar-presets/moon-violet.svg" },
  { id: "cactus-lime", label: "Cactus", src: "/avatar-presets/cactus-lime.svg" },
  { id: "ghost-cyan", label: "Ghost", src: "/avatar-presets/ghost-cyan.svg" },
  { id: "octopus-pink", label: "Octopus", src: "/avatar-presets/octopus-pink.svg" },
  { id: "frog-lime", label: "Frog", src: "/avatar-presets/frog-lime.svg" },
  { id: "cat-violet", label: "Cat", src: "/avatar-presets/cat-violet.svg" },
  { id: "mushroom-pink", label: "Mushroom", src: "/avatar-presets/mushroom-pink.svg" },
  { id: "rocket-cyan", label: "Rocket", src: "/avatar-presets/rocket-cyan.svg" },
  { id: "ufo-violet", label: "UFO", src: "/avatar-presets/ufo-violet.svg" },
  { id: "donut-pink", label: "Donut", src: "/avatar-presets/donut-pink.svg" },
  { id: "planet-cyan", label: "Planet", src: "/avatar-presets/planet-cyan.svg" },
  { id: "fish-lime", label: "Fish", src: "/avatar-presets/fish-lime.svg" },
  { id: "bee-lime", label: "Bee", src: "/avatar-presets/bee-lime.svg" },
  { id: "snail-violet", label: "Snail", src: "/avatar-presets/snail-violet.svg" },
  { id: "cupcake-pink", label: "Cupcake", src: "/avatar-presets/cupcake-pink.svg" },
  { id: "slime-lime", label: "Slime", src: "/avatar-presets/slime-lime.svg" },
  { id: "bolt-cyan", label: "Bolt", src: "/avatar-presets/bolt-cyan.svg" },
  { id: "leaf-lime", label: "Leaf", src: "/avatar-presets/leaf-lime.svg" },
  { id: "flower-pink", label: "Flower", src: "/avatar-presets/flower-pink.svg" },
  { id: "penguin-cyan", label: "Penguin", src: "/avatar-presets/penguin-cyan.svg" },
  { id: "whale-violet", label: "Whale", src: "/avatar-presets/whale-violet.svg" },
  { id: "dino-lime", label: "Dino", src: "/avatar-presets/dino-lime.svg" },
  { id: "robot-pink", label: "Robot", src: "/avatar-presets/robot-pink.svg" }
];

export function presetById(id) {
  return AVATAR_PRESETS.find((preset) => preset.id === id) || null;
}

export function resolveAvatarDisplay({ avatar, avatarUrl } = {}) {
  const byId = presetById(avatar);
  if (byId) return { kind: "preset", src: byId.src, id: byId.id };
  const bySrc = AVATAR_PRESETS.find((preset) => preset.src === avatarUrl);
  if (bySrc) return { kind: "preset", src: bySrc.src, id: bySrc.id };
  if (typeof avatarUrl === "string" && (avatarUrl.startsWith("data:") || /^https?:\/\//.test(avatarUrl))) {
    const fallback = presetById(DEFAULT_PRESET_ID);
    return { kind: "preset", src: fallback.src, id: fallback.id };
  }
  return { kind: "silhouette" };
}
