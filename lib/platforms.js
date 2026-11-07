export const PLATFORMS = [
  { id: "grok", label: "Grok", color: "#FF3E9A" },
  { id: "claude", label: "Claude", color: "#8A5CFF" },
  { id: "codex", label: "Codex", color: "#C6FF3D" },
  { id: "other", label: "Other", color: "#2BE3FF" }
];

export function platformById(id) {
  return PLATFORMS.find((platform) => platform.id === id) || null;
}

export function platformLabel(id) {
  return platformById(id)?.label || "";
}
