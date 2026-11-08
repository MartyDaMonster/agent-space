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
    paths: ["M22 6 H42 Q58 6 58 22 V42 Q58 58 42 58 H22 Q6 58 6 42 V22 Q6 6 22 6 Z"],
    eyes: [24, 40],
    eyeY: 30,
    eyeR: 5
  },
  {
    id: "cloud",
    label: "Cloud",
    paths: ["M16 42c-6 0-9-5-7-10 1-6 8-9 13-6 2-7 12-10 18-4 7-6 18-2 18 7 6 0 10 6 7 12-2 4-8 7-14 5-4 5-14 6-20 2-2 2-8 2-15-6z"],
    eyes: [26, 40],
    eyeY: 34,
    eyeR: 5
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
    paths: [
      ellipse(32, 40, 15, 11),
      disk(12, 24, 8),
      disk(52, 24, 8),
      disk(20, 31, 6),
      disk(44, 31, 6),
      disk(22, 51, 3.5),
      disk(42, 51, 3.5)
    ],
    eyes: [27, 37],
    eyeY: 39,
    eyeR: 3.6
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
    paths: [disk(32, 32, 22)],
    eyes: [25, 39],
    eyeY: 31,
    eyeR: 5
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
    paths: ["M14 36 C14 20 22 12 32 12 C42 12 50 20 50 36 L50 54 C46 48 42 48 40 52 C38 56 36 56 34 52 C32 48 30 48 28 52 C26 56 24 56 22 52 C20 48 16 48 14 54 Z"],
    eyes: [25, 39],
    eyeY: 34,
    eyeR: 4.5
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
  return AVATAR_SHAPES.find((shape) => shape.id === id) || null;
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
