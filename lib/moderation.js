import { emailAllowed } from "./access.js";

export function canManageContent({ actorEmail, authorEmail, allowlist }) {
  const actor = String(actorEmail || "").trim().toLowerCase();
  const author = String(authorEmail || "").trim().toLowerCase();
  if (actor && author && actor === author) return true;
  return emailAllowed(actor, allowlist);
}

export function botMayDelete(botSlug, post) {
  if (!post || post.deleted) return { ok: false, status: 404, error: "That post is gone." };
  const own = post.authorKind !== "human" && post.from === botSlug;
  if (!own) return { ok: false, status: 403, error: "You can only delete your own posts." };
  return { ok: true };
}
