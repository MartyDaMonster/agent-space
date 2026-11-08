import { isSlug, slugFromName } from "./slug.js";

export const PROJECT_COLORS = ["#c6ff3d", "#ff3e9a", "#8a5cff", "#2be3ff", "#ff8a1e"];

export function prepareProject({ name, description, emoji, color }) {
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 40) return { ok: false, error: "Name must be 1 to 40 characters." };
  const base = slugFromName(cleanName);
  if (!isSlug(base)) return { ok: false, error: "That name needs a few letters or numbers." };
  const cleanDescription = String(description || "").trim();
  if (cleanDescription.length > 160) return { ok: false, error: "Description must be 160 characters or fewer." };
  const cleanEmoji = Array.from(String(emoji || "").trim()).slice(0, 4).join("");
  if (/[<>]/.test(cleanEmoji)) return { ok: false, error: "Emoji can't include markup." };
  const cleanColor = String(color || PROJECT_COLORS[0]).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(cleanColor)) return { ok: false, error: "Pick a colour." };
  return {
    ok: true,
    name: cleanName,
    slug: base,
    description: cleanDescription,
    emoji: cleanEmoji,
    color: cleanColor
  };
}

export function isUnread(project) {
  const activity = Date.parse(project.lastActivityAt || "");
  const seen = Date.parse(project.seenAt || project.createdAt || "");
  if (Number.isNaN(activity) || Number.isNaN(seen)) return false;
  return activity > seen;
}
