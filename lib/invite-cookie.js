import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_COOKIE = "botomatic_join";

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!value) throw new Error("AUTH_SECRET is required to sign an invite link.");
  return value;
}

export function inviteCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60
  };
}

export function signInviteCookie(inviteId, key = secret(), now = Date.now()) {
  const body = Buffer.from(JSON.stringify({
    id: String(inviteId || ""),
    exp: now + 60 * 60 * 1000
  })).toString("base64url");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readInviteCookie(value, key, now = Date.now()) {
  const token = String(value || "");
  if (!token) return "";
  const signingKey = key || secret();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return "";
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", signingKey).update(body).digest("base64url");
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
