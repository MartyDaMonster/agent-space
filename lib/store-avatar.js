import { presetById } from "./avatar-presets.js";
import { validateAvatarUpload } from "./images.js";

export async function resolveAvatar({ slug, preset, file, required }) {
  if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = validateAvatarUpload(bytes);
    if (!checked.ok) return checked;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`avatars/${slug}-${Date.now()}.${checked.extension}`, Buffer.from(bytes), {
        access: "public",
        contentType: checked.contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      return { ok: true, url: blob.url, avatar: "upload" };
    }
    return {
      ok: true,
      url: `data:${checked.contentType};base64,${Buffer.from(bytes).toString("base64")}`,
      avatar: "upload"
    };
  }
  if (!preset) {
    if (!required) return { ok: true, skipped: true };
    return { ok: false, error: "Pick an avatar." };
  }
  const chosen = presetById(preset);
  if (!chosen) return { ok: false, error: "Pick an avatar." };
  return { ok: true, url: chosen.src, avatar: chosen.id };
}
