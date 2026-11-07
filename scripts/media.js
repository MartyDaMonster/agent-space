const IMAGE_EXT = /\.(svg|png|jpe?g|gif|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|ogv)$/i;

export function safeAssetPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!/^(assets|avatars)\/[A-Za-z0-9._/-]+$/.test(path)) return null;
  if (path.includes("..")) return null;
  return path;
}

export function safeHttpsUrl(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url;
}

function host(url) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function youtubeId(value) {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const name = host(url);
  if (name === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (name === "youtube.com" || name === "m.youtube.com" || name === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") || "";
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const embed = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/);
    if (embed) return embed[1];
    const shorts = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/);
    if (shorts) return shorts[1];
  }
  return null;
}

export function vimeoId(value) {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const name = host(url);
  if (name === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return /^\d{6,12}$/.test(id) ? id : null;
  }
  if (name === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d{6,12})\/?$/);
    return match ? match[1] : null;
  }
  return null;
}

export function classifyMedia(media) {
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return { ok: false, reason: "Media must be an object." };
  }
  const kind = typeof media.kind === "string" ? media.kind.trim() : "";
  const alt = typeof media.alt === "string" ? media.alt.trim() : "";
  const rawUrl = typeof media.url === "string" ? media.url.trim() : "";
  if (!["image", "youtube", "vimeo", "video", "link"].includes(kind)) {
    return { ok: false, reason: "Media kind must be image, youtube, vimeo, video, or link." };
  }
  if (!alt || alt.length > 200) {
    return { ok: false, reason: "Media alt text is required and must be 200 characters or fewer." };
  }
  if (!rawUrl || rawUrl.length > 500) {
    return { ok: false, reason: "Media URL is required and must be 500 characters or fewer." };
  }

  if (kind === "image") {
    const asset = safeAssetPath(rawUrl);
    if (asset && IMAGE_EXT.test(asset)) return { ok: true, kind, alt, src: asset };
    const remote = safeHttpsUrl(rawUrl);
    if (remote && IMAGE_EXT.test(remote.pathname)) return { ok: true, kind, alt, src: remote.href };
    return { ok: false, reason: "Images must be a site asset or an https image file." };
  }

  if (kind === "youtube") {
    const id = youtubeId(rawUrl);
    if (!id) return { ok: false, reason: "YouTube URL is not on the allowlist." };
    return {
      ok: true,
      kind,
      alt,
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=0`
    };
  }

  if (kind === "vimeo") {
    const id = vimeoId(rawUrl);
    if (!id) return { ok: false, reason: "Vimeo URL is not on the allowlist." };
    return {
      ok: true,
      kind,
      alt,
      src: `https://player.vimeo.com/video/${id}?autoplay=0`
    };
  }

  if (kind === "video") {
    const remote = safeHttpsUrl(rawUrl);
    if (!remote || !VIDEO_EXT.test(remote.pathname)) {
      return { ok: false, reason: "Videos must be an https .mp4, .webm, or .ogv file." };
    }
    return { ok: true, kind, alt, src: remote.href };
  }

  const remote = safeHttpsUrl(rawUrl);
  if (!remote) return { ok: false, reason: "Links must be https URLs without sign-in details." };
  return { ok: true, kind: "link", alt, src: remote.href };
}
