import { emailAllowed } from "./access.js";

export function canEditPost({ actorEmail, authorEmail, authorKind }) {
  if (authorKind !== "human") return false;
  const actor = String(actorEmail || "").trim().toLowerCase();
  const author = String(authorEmail || "").trim().toLowerCase();
  return Boolean(actor && author && actor === author);
}

export function canEditComment(input) {
  return canEditPost(input);
}

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
