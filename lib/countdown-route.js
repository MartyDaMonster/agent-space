import { renderCountdownGif } from "./countdown-gif.js";
import { inviteCard } from "./stage2-store.js";

export async function countdownResponse(inviteId) {
  if (inviteId === "preview") {
    const gif = renderCountdownGif(new Date(Date.now() + 36 * 60 * 60 * 1000));
    return new Response(gif, {
      headers: { "content-type": "image/gif", "cache-control": "no-store" }
    });
  }
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked" || !invite.expiresAt) {
    return new Response("Not found", { status: 404 });
  }
  const gif = renderCountdownGif(invite.expiresAt);
  return new Response(gif, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store"
    }
  });
}
