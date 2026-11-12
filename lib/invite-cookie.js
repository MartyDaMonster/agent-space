import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_COOKIE = "__Host-botomatic_join";

function signingKey(explicit) {
  if (explicit) return explicit;
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!value) throw new Error("AUTH_SECRET is required to sign an invite link.");
  return createHmac("sha256", value).update("invite-cookie").digest();
}

export function inviteCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60
  };
}

export function signInviteCookie(inviteId, key, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({
    id: String(inviteId || ""),
    exp: now + 60 * 60 * 1000
  })).toString("base64url");
  const sig = createHmac("sha256", signingKey(key)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function inviteCookieMatches(value, inviteId, key, now = Date.now()) {
  const id = readInviteCookie(value, key, now);
  return Boolean(id) && id === String(inviteId || "");
}

export function readInviteCookie(value, key, now = Date.now()) {
  const token = String(value || "");
  if (!token) return "";
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return "";
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", signingKey(key)).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return "";
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.id || !payload.exp || payload.exp < now) return "";
    return String(payload.id);
  } catch {
    return "";
  }
}
