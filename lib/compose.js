import { safeHttpsUrl, vimeoId, youtubeId } from "../scripts/media.js";

export const REACTION_EMOJI = ["👍", "❤️", "🎉", "👀", "🤖"];

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`;
  return (letters || "?").toUpperCase();
}

export function draftAfterSave(draft, result) {
  if (result?.saved) return "";
  return draft;
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

function ipv4Parts(address) {
  const parts = String(address || "").split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return numbers;
}

function blockedIpv4(parts) {
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function expandIpv6(address) {
  const zone = address.split("%")[0];
  const pieces = zone.split("::");
  if (pieces.length > 2) return null;
  const left = pieces[0] ? pieces[0].split(":") : [];
  const right = pieces[1] ? pieces[1].split(":") : [];
  const groups = zone.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  if (groups.length !== 8) return null;
  const parsed = groups.map((group) => (/^[0-9a-f]{1,4}$/i.test(group) ? Number.parseInt(group, 16) : NaN));
  if (parsed.some((group) => Number.isNaN(group))) return null;
  return parsed;
}

function ipv4FromGroups(high, low) {
  return [(high >> 8) & 255, high & 255, (low >> 8) & 255, low & 255];
}

function blockedIpv6(address) {
  const dotted = address.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const embedded = ipv4Parts(dotted[2]);
    const prefix = dotted[1].toLowerCase();
    if (!embedded) return true;
    if (prefix === "::ffff:" || prefix === "64:ff9b::") return blockedIpv4(embedded);
    return true;
  }
  const groups = expandIpv6(address);
  if (!groups) return true;
  const [g0, g1, g2, , , g5, g6, g7] = groups;
  if (groups.every((group) => group === 0) || (groups.slice(0, 7).every((group) => group === 0) && g7 === 1)) return true;
  if ((g0 & 0xfe00) === 0xfc00) return true;
  if ((g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0) return true;
  if ((g0 & 0xff00) === 0xff00) return true;
  if (g0 === 0x2001 && g1 === 0x0db8) return true;
  if (groups.slice(0, 5).every((group) => group === 0) && g5 === 0xffff) return blockedIpv4(ipv4FromGroups(g6, g7));
  if (g0 === 0x64 && g1 === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) return blockedIpv4(ipv4FromGroups(g6, g7));
  if (g0 === 0x2002) return blockedIpv4(ipv4FromGroups(g1, g2));
  return false;
}

export function isBlockedAddress(address) {
  const name = String(address || "").replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  const v4 = ipv4Parts(name);
  if (v4) return blockedIpv4(v4);
  if (name.includes(":")) return blockedIpv6(name);
  return false;
}

export function isBlockedHost(hostname) {
  const name = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!name || name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name.includes(":") || ipv4Parts(name)) return isBlockedAddress(name);
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

