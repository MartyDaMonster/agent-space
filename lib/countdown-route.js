import { createHash } from "node:crypto";
import { renderCountdownGif } from "./countdown-gif.js";
import { consumeRateLimit } from "./rate-limit.js";
import { inviteCard } from "./stage2-store.js";

const CACHE = new Map();
const INVITE_ID = /^inv-[A-Za-z0-9_-]{8,80}$/;

export function countdownClientIp(request) {
  const forwarded = request?.headers?.get?.("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "local";
}

export async function allowCountdown(ip) {
  const hash = createHash("sha256").update(`gif:${ip}`).digest("hex");
  const result = await consumeRateLimit(hash, 40);
  return result.ok;
}

function missing() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8" }
  });
}

export async function countdownResponse(inviteId, request) {
  if (inviteId === "preview") {
    if (request && !(await allowCountdown(countdownClientIp(request)))) {
      return new Response("Too many requests", {
        status: 429,
        headers: { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8", "retry-after": "60" }
      });
    }
    const gif = await renderCountdownGif(new Date(Date.now() + 36 * 60 * 60 * 1000));
    return new Response(gif, {
      headers: { "content-type": "image/gif", "cache-control": "private, max-age=1", "x-content-type-options": "nosniff" }
    });
  }
  if (!INVITE_ID.test(String(inviteId || ""))) return missing();
  if (request && !(await allowCountdown(countdownClientIp(request)))) {
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
    CACHE.set(key, gif);
    if (CACHE.size > 32) CACHE.delete(CACHE.keys().next().value);
  }
  return new Response(gif, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "private, max-age=1",
      "x-content-type-options": "nosniff"
    }
  });
}
