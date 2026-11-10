import { renderCountdownPng } from "./countdown-png.js";
import { inviteCard } from "./stage2-store.js";

const INVITE_ID = /^inv-[A-Za-z0-9_-]{8,80}$/;

export const COUNTDOWN_HEADERS = {
  "content-type": "image/png",
  "cache-control": "no-store, no-cache, max-age=0",
  expires: "0",
  pragma: "no-cache",
  "x-content-type-options": "nosniff"
};

function missing() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }
  });
}

async function pngResponse(expiresAt) {
  const png = await renderCountdownPng(expiresAt);
  return new Response(png, { headers: COUNTDOWN_HEADERS });
}

export async function countdownResponse(inviteId) {
  if (inviteId === "preview") {
    return pngResponse(new Date(Date.now() + 36 * 60 * 60 * 1000));
  }
  if (!INVITE_ID.test(String(inviteId || ""))) return missing();
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked" || !invite.expiresAt) return missing();
  return pngResponse(invite.expiresAt);
}
