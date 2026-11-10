function disk(cx, cy, r) {
  return ellipse(cx, cy, r, r);
}

function ellipse(cx, cy, rx, ry) {
  const n = (value) => Number(value.toFixed(2));
  return `M ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} Z`;
}

function starPath(cx, cy, outer, inner, points = 5) {
  const coords = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    coords.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M ${coords.join(" L ")} Z`;
}

function sunPaths() {
  const paths = [disk(32, 32, 13)];
  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    const spread = 0.2;
    const point = (radius, delta) => [
      (32 + radius * Math.cos(angle + delta)).toFixed(2),
      (32 + radius * Math.sin(angle + delta)).toFixed(2)
    ];
    const [x1, y1] = point(12, -spread);
    const [x2, y2] = point(28, 0);
    const [x3, y3] = point(12, spread);
    paths.push(`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`);
  }
  return paths;
}

export const AVATAR_COLORS = [
  { id: "lime", label: "Lime", hex: "#a3d32b", light: true },
  { id: "coral", label: "Coral", hex: "#ff5a5f" },
  { id: "pink", label: "Pink", hex: "#FF3E9A" },
  { id: "violet", label: "Violet", hex: "#8A5CFF" },
  { id: "cyan", label: "Cyan", hex: "#2BE3FF", light: true },
  { id: "orange", label: "Orange", hex: "#FF8A1E" },
  { id: "yellow", label: "Yellow", hex: "#FFE14A", light: true },
  { id: "red", label: "Red", hex: "#FF3B4E" },
  { id: "blue", label: "Blue", hex: "#4C8DFF" },
  { id: "grey", label: "Grey", hex: "#D7DCE6", light: true }
];

export const AVATAR_SHAPES = [
  {
    id: "square",
    label: "Square",
    paths: ["M9 26 H55 Q55 12 41 12 H23 Q9 12 9 26 V44 Q9 58 23 58 H41 Q55 58 55 44 Z"],
    eyes: [37, 47],
    eyeY: 33,
    eyeR: 4.2,
    eyeRx: 3.9,
    eyeRy: 4.6
  },
  {
    id: "cloud",
    label: "Cloud",
    paths: ["M5 48 H59 Q59 38 49 38 A13 13 0 0 0 25 33 A12.5 12.5 0 0 0 15 43 A10 10 0 0 0 5 48 Z"],
    eyes: [27, 38],
    eyeY: 44,
    eyeR: 4.1,
    eyeRx: 3.8,
    eyeRy: 4.5
  },
  {
    id: "dome",
    label: "Dome",
    paths: ["M8 46 C8 22 20 10 32 10 C44 10 56 22 56 46 Z"],
    eyes: [24, 40],
    eyeY: 32,
    eyeR: 5
  },
  {
    id: "star",
    label: "Star",
    paths: [starPath(32, 32, 26, 12)],
    eyes: [27, 37],
    eyeY: 34,
    eyeR: 3.4
  },
  {
    id: "capsule",
    label: "Capsule",
    paths: ["M24 16 H40 Q56 16 56 32 Q56 48 40 48 H24 Q8 48 8 32 Q8 16 24 16 Z"],
    eyes: [24, 40],
    eyeY: 32,
    eyeR: 5
  },
  {
    id: "diamond",
    label: "Diamond",
    paths: ["M32 6 L56 32 L32 58 L8 32 Z"],
    eyes: [27, 37],
    eyeY: 33,
    eyeR: 4
  },
  {
    id: "sun",
    label: "Sun",
    paths: sunPaths(),
    eyes: [27, 37],
    eyeY: 32,
    eyeR: 3.6
  },
  {
    id: "crab",
    label: "Crab",
    paths: [ellipse(32, 44, 17.5, 13)],
    eyes: [26.5, 37.5],
    eyeY: 40,
    eyeR: 4.3,
    eyeRx: 4,
    eyeRy: 4.7
  },
  {
    id: "sheep",
    label: "Sheep",
    paths: [
      disk(32, 30, 14),
      disk(20, 28, 9),
      disk(44, 28, 9),
      disk(26, 18, 8),
      disk(38, 18, 8),
      disk(32, 40, 9),
      "M22 46 H28 V58 H22 Z",
      "M36 46 H42 V58 H36 Z"
    ],
    eyes: [27, 37],
    eyeY: 40,
    eyeR: 3.4
  },
  {
    id: "heart",
    label: "Heart",
    paths: ["M32 54 C18 44 8 34 8 24 C8 15 15 9 23 11 C28 12 31 16 32 20 C33 16 36 12 41 11 C49 9 56 15 56 24 C56 34 46 44 32 54 Z"],
    eyes: [24, 40],
    eyeY: 28,
    eyeR: 4
  },
  {
    id: "circle",
    label: "Circle",
    paths: [disk(32, 36, 22)],
    eyes: [36, 46],
    eyeY: 28,
    eyeR: 4.2,
    eyeRx: 3.8,
    eyeRy: 4.6
  },
  {
    id: "triangle",
    label: "Triangle",
    paths: ["M32 8 Q36 8 38 14 L54 48 Q58 56 50 56 H14 Q6 56 10 48 L26 14 Q28 8 32 8 Z"],
    eyes: [26, 38],
    eyeY: 42,
    eyeR: 4
  },
  {
    id: "flower",
    label: "Flower",
    paths: [
      disk(32, 19, 10),
      disk(43.3, 25.5, 10),
      disk(43.3, 38.5, 10),
      disk(32, 45, 10),
      disk(20.7, 38.5, 10),
      disk(20.7, 25.5, 10),
      disk(32, 32, 11)
    ],
    eyes: [27.5, 36.5],
    eyeY: 33,
    eyeR: 3.2
  },
  {
    id: "ghost",
    label: "Ghost",
    paths: ["M13 33 C13 19 21 10 32 10 C43 10 51 19 51 33 L51 57 C48.5 59 46.5 53 43.5 53 C40.5 53 40 58.5 37.5 58.5 C35 58.5 34.5 53 32 53 C29.5 53 29 58.5 26.5 58.5 C24 58.5 23.5 53 20.5 53 C17.5 53 15.5 59 13 57 Z"],
    eyes: [26, 37],
    eyeY: 29,
    eyeR: 4.1,
    eyeRx: 3.6,
    eyeRy: 4.6
  },
  {
    id: "cat",
    label: "Cat",
    paths: [
      disk(32, 40, 16),
      "M18 32 L15 12 L30 28 Z",
      "M46 32 L49 12 L34 28 Z"
    ],
    eyes: [26, 38],
    eyeY: 40,
    eyeR: 4.4
  }
];

export const LEGACY_AVATARS = {
  "square-lime": ["square", "lime"],
  "cloud-pink": ["cloud", "pink"],
  "dome-violet": ["dome", "violet"],
  "star-cyan": ["star", "cyan"],
  "capsule-cyan": ["capsule", "cyan"],
  "diamond-pink": ["diamond", "pink"],
  "crab-cyan": ["crab", "cyan"],
  "sheep-lime": ["sheep", "lime"],
  "sun-lime": ["sun", "lime"],
  "moon-violet": ["circle", "violet"],
  "cactus-lime": ["triangle", "lime"],
  "ghost-cyan": ["ghost", "cyan"],
  "octopus-pink": ["crab", "pink"],
  "frog-lime": ["circle", "lime"],
  "cat-violet": ["cat", "violet"],
  "mushroom-pink": ["dome", "pink"],
  "rocket-cyan": ["triangle", "cyan"],
  "ufo-violet": ["capsule", "violet"],
  "donut-pink": ["circle", "pink"],
  "planet-cyan": ["circle", "cyan"],
  "fish-lime": ["capsule", "lime"],
  "bee-lime": ["circle", "lime"],
  "snail-violet": ["circle", "violet"],
  "cupcake-pink": ["dome", "pink"],
  "slime-lime": ["cloud", "lime"],
  "bolt-cyan": ["star", "cyan"],
  "leaf-lime": ["triangle", "lime"],
  "flower-pink": ["flower", "pink"],
  "penguin-cyan": ["capsule", "cyan"],
  "whale-violet": ["capsule", "violet"],
  "dino-lime": ["triangle", "lime"],
  "robot-pink": ["square", "pink"]
};

export const DEFAULT_AVATAR = { shape: "cloud", color: "pink" };

export function shapeById(id) {
  const key = id === "ball" ? "circle" : id;
  return AVATAR_SHAPES.find((shape) => shape.id === key) || null;
}

export function motionForSize(px) {
  return Number(px) >= 48 ? "full" : "calm";
}

export function motionTiming(seed) {
  let hash = 2166136261;
  const text = String(seed || "bot");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bucket = hash >>> 0;
  return {
    "--idle-delay": `${-((bucket % 48) / 10).toFixed(2)}s`,
    "--blink-delay": `${-(((bucket >>> 4) % 68) / 10).toFixed(2)}s`,
    "--blink-span": `${(4.2 + (bucket % 9) * 0.34).toFixed(2)}s`
  };
}

export function colorById(id) {
  return AVATAR_COLORS.find((color) => color.id === id) || null;
}

function pack(shapeId, colorId) {
  const shape = shapeById(shapeId);
  const color = colorById(colorId);
  if (!shape || !color) return null;
  return { shape: shape.id, color: color.id, hex: color.hex };
}

function fromLegacyId(id) {
  const pair = LEGACY_AVATARS[id];
  return pair ? pack(pair[0], pair[1]) : null;
}

function fromPresetUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/avatar-presets\/([a-z0-9-]+)\.svg$/);
  return match ? fromLegacyId(match[1]) : null;
}

function hashChoice(slug) {
  let hash = 0;
  for (const char of String(slug || "")) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return pack(
    AVATAR_SHAPES[hash % AVATAR_SHAPES.length].id,
    AVATAR_COLORS[hash % AVATAR_COLORS.length].id
  );
}

export function resolveAvatarChoice({ avatar, avatarUrl, avatarShape, avatarColor, slug } = {}) {
  return pack(avatarShape, avatarColor)
    || fromLegacyId(avatar)
    || fromPresetUrl(avatarUrl)
    || fromPresetUrl(avatar)
    || (shapeById(avatar) ? pack(avatar, colorById(avatarColor) ? avatarColor : "pink") : null)
    || ((typeof avatarUrl === "string" && (avatarUrl.startsWith("data:") || /^https?:\/\//.test(avatarUrl)))
      ? pack(DEFAULT_AVATAR.shape, DEFAULT_AVATAR.color)
      : null)
    || (slug ? hashChoice(slug) : null)
    || pack(DEFAULT_AVATAR.shape, DEFAULT_AVATAR.color);
}
