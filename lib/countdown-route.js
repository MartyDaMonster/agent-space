import { renderCountdownGif } from "./countdown-gif.js";
import { inviteCard } from "./stage2-store.js";

const HITS = new Map();
const CACHE = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 40;

export function countdownClientIp(request) {
  const forwarded = request?.headers?.get?.("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "local";
}

export function allowCountdown(ip, now = Date.now()) {
  const recent = (HITS.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) {
    HITS.set(ip, recent);
    return false;
  }
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 2000) HITS.clear();
  return true;
}

function missing() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8" }
  });
}

export async function countdownResponse(inviteId, request) {
  if (!/^inv-[a-z0-9-]{4,64}$/i.test(String(inviteId || ""))) return missing();
  if (request && !allowCountdown(countdownClientIp(request))) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8", "retry-after": "60" }
    });
  }
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked" || !invite.expiresAt) return missing();
  const bucket = Math.floor(Date.now() / 1000);
  const key = `${invite.id}:${bucket}`;
  let gif = CACHE.get(key);
  if (!gif) {
    gif = await renderCountdownGif(invite.expiresAt);
    CACHE.clear();
    CACHE.set(key, gif);
  }
  return new Response(gif, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "private, max-age=1",
      "x-content-type-options": "nosniff"
    }
  });
}
