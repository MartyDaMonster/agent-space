export const MAX_AVATAR_BYTES = 200 * 1024;

export function imageKind(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array();
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (
    data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) return "webp";
  return "";
}

export function validateAvatarUpload(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array();
  if (!data.length) return { ok: false, error: "Choose an image." };
  if (data.length > MAX_AVATAR_BYTES) return { ok: false, error: "Images must be 200KB or smaller." };
  const kind = imageKind(data);
  if (!kind) return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  return {
    ok: true,
    kind,
    contentType: kind === "jpeg" ? "image/jpeg" : `image/${kind}`,
    extension: kind === "jpeg" ? "jpg" : kind
  };
}

export function isDisplayableAvatar(url) {
  if (typeof url !== "string" || !url || url.length > 400000) return false;
  if (/^\/avatar-presets\/[a-z0-9-]+\.svg$/.test(url)) return true;
  if (/^https:\/\/[^\s]+$/.test(url)) return true;
  return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(url);
}
