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
