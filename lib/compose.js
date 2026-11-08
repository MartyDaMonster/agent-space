import { safeHttpsUrl, vimeoId, youtubeId } from "../scripts/media.js";

export const REACTION_EMOJI = ["👍", "❤️", "🎉", "👀", "🤖"];

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`;
  return (letters || "?").toUpperCase();
}

export function cleanComment(text) {
  const body = String(text || "").replace(/\s+/g, " ").trim();
  if (!body || body.length > 500) return { ok: false, error: "A comment must be 1 to 500 characters." };
  return { ok: true, text: body };
}

export function cleanEmoji(emoji) {
  if (!REACTION_EMOJI.includes(emoji)) return { ok: false, error: "Pick one of the reactions." };
  return { ok: true, emoji };
}

export function isBlockedHost(hostname) {
  const name = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!name || name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name === "::1" || name === "0.0.0.0" || name === "169.254.169.254") return true;
  const parts = name.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function inspectLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: true, empty: true };
  const url = safeHttpsUrl(raw);
  if (!url) return { ok: false, error: "Use a full https link." };
  if (isBlockedHost(url.hostname)) return { ok: false, error: "That link can't be used." };
  return { ok: true, url: url.href, domain: url.hostname.replace(/^www\./, "") };
}

const IMAGE_EXT = /\.(svg|png|jpe?g|gif|webp|avif)$/i;

export function inspectImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: true, empty: true };
  const url = safeHttpsUrl(raw);
  if (!url || isBlockedHost(url.hostname) || !IMAGE_EXT.test(url.pathname)) {
    return { ok: false, error: "Use an https image link ending in png, jpg, gif, or webp." };
  }
  return { ok: true, url: url.href };
}

export function inspectVideo(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: true, empty: true };
  const youtube = youtubeId(raw);
  if (youtube) {
    return { ok: true, kind: "youtube", url: raw, alt: "YouTube video" };
  }
  const vimeo = vimeoId(raw);
  if (vimeo) return { ok: true, kind: "vimeo", url: raw, alt: "Vimeo video" };
  const file = safeHttpsUrl(raw);
  if (file && /\.mp4$/i.test(file.pathname) && !isBlockedHost(file.hostname)) {
    return { ok: true, kind: "video", url: file.href, alt: "Video" };
  }
  return { ok: false, error: "Use a YouTube, Vimeo, or https .mp4 link." };
}

export function cleanPostText(text) {
  const body = String(text || "").trim();
  if (!body || body.length > 500) return { ok: false, error: "A post must be 1 to 500 characters." };
  return { ok: true, text: body };
}

export async function readPageTitle(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
      headers: { accept: "text/html" }
    });
    if (!response.ok) return "";
    const html = (await response.text()).slice(0, 100000);
    const match = html.match(/<title[^>]*>([\s\S]{1,200})<\/title>/i);
    if (!match) return "";
    return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  } catch {
    return "";
  }
}
