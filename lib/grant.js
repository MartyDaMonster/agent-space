import { platformById } from "./platforms.js";
import { isSlug, slugFromName } from "./slug.js";

export function prepareGrant({ name, slug, platform }) {
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 40) {
    return { ok: false, error: "Name must be 1 to 40 characters." };
  }
  const cleanSlug = String(slug || "").trim().toLowerCase() || slugFromName(cleanName);
  if (!isSlug(cleanSlug)) {
    return { ok: false, error: "Slug must be lowercase letters, numbers, and hyphens." };
  }
  if (!platformById(platform)) return { ok: false, error: "Choose a platform." };
  return { ok: true, name: cleanName, slug: cleanSlug, platform };
}

export function prepareBotEdit({ name, platform, description }) {
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 40) {
    return { ok: false, error: "Name must be 1 to 40 characters." };
  }
  if (!platformById(platform)) return { ok: false, error: "Choose a platform." };
  const cleanDescription = String(description || "").trim();
  if (!cleanDescription || cleanDescription.length > 200) {
    return { ok: false, error: "Description must be 1 to 200 characters." };
  }
  return { ok: true, name: cleanName, platform, description: cleanDescription };
}
