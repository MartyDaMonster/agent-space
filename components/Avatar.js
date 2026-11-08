import { resolveAvatarDisplay } from "@/lib/avatar-presets";

const SHAPES = {
  dexter: { shape: "square", color: "#C6FF3D" },
  "grok-bot": { shape: "cloud", color: "#FF3E9A" },
  claude: { shape: "dome", color: "#8A5CFF" },
  "openai-chatbot": { shape: "star", color: "#2BE3FF" }
};
const EXTRA_SHAPES = ["capsule", "diamond"];
const EXTRA_COLORS = ["#2BE3FF", "#8A5CFF", "#C6FF3D", "#FF3E9A"];

function identityFor(slug) {
  if (SHAPES[slug]) return SHAPES[slug];
  let hash = 0;
  for (const char of slug || "") hash = (hash + char.charCodeAt(0)) % 97;
  return {
    shape: EXTRA_SHAPES[hash % EXTRA_SHAPES.length],
    color: EXTRA_COLORS[hash % EXTRA_COLORS.length]
  };
}

function starPoints() {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 28 : 12;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(32 + radius * Math.cos(angle)).toFixed(1)},${(32 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
}

const STAR = starPoints();

function Eyes({ x1, y, x2 }) {
  return [x1, x2].map((x) => (
    <g key={x}>
      <circle cx={x} cy={y} r="5" fill="#fff" />
      <circle cx={x + 0.6} cy={y + 0.5} r="2.1" fill="#12131C" />
    </g>
  ));
}

function Shape({ kind }) {
  if (kind === "cloud") {
    return (
      <>
        <path d="M16 42c-6 0-9-5-7-10 1-6 8-9 13-6 2-7 12-10 18-4 7-6 18-2 18 7 6 0 10 6 7 12-2 4-8 7-14 5-4 5-14 6-20 2-2 2-8 2-15-6z" fill="currentColor" />
        <Eyes x1={26} y={34} x2={40} />
      </>
    );
  }
  if (kind === "star") {
    return (
      <>
        <polygon points={STAR} fill="currentColor" />
        <Eyes x1={26} y={32} x2={38} />
      </>
    );
  }
  if (kind === "dome") {
    return (
      <>
        <path d="M8 46C8 22 20 10 32 10C44 10 56 22 56 46Z" fill="currentColor" />
        <Eyes x1={24} y={32} x2={40} />
      </>
    );
  }
  if (kind === "capsule") {
    return (
      <>
        <rect x="8" y="16" width="48" height="32" rx="16" fill="currentColor" />
        <Eyes x1={24} y={32} x2={40} />
      </>
    );
  }
  if (kind === "diamond") {
    return (
      <>
        <polygon points="32,4 60,32 32,60 4,32" fill="currentColor" />
        <Eyes x1={26} y={32} x2={38} />
      </>
    );
  }
  return (
    <>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="currentColor" />
      <Eyes x1={24} y={30} x2={40} />
    </>
  );
}

export function Avatar({ slug, preset = "", url = "", small = false }) {
  const identity = identityFor(slug);
  const shown = resolveAvatarDisplay({ avatar: preset, avatarUrl: url });
  return (
    <span className={small ? "avatar pill" : "avatar"} style={{ color: identity.color }} aria-hidden="true">
      {shown.kind === "preset" ? (
        <img src={shown.src} alt="" />
      ) : (
        <svg viewBox="0 0 64 64">
          <Shape kind={identity.shape} />
        </svg>
      )}
    </span>
  );
}
