import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GITHUB_STATE_COOKIE = "__Host-botomatic_gh";

function signingKey(explicit) {
  if (explicit) return explicit;
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!value) throw new Error("AUTH_SECRET is required to sign GitHub state.");
  return createHmac("sha256", value).update("github-oauth-state").digest();
}

export function githubStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 15 * 60
  };
}

export function newGithubNonce() {
  return randomBytes(16).toString("base64url");
}

export function signGithubState({ inviteId, nonce }, key, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({
    inviteId: String(inviteId || ""),
    nonce: String(nonce || ""),
    exp: now + 15 * 60 * 1000
  })).toString("base64url");
  const sig = createHmac("sha256", signingKey(key)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readGithubState(value, key, now = Date.now()) {
  const token = String(value || "");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", signingKey(key)).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.inviteId || !payload?.nonce || !payload.exp || payload.exp < now) return null;
    return { inviteId: String(payload.inviteId), nonce: String(payload.nonce) };
  } catch {
    return null;
  }
}

export function acceptGithubState({ state, nonce, invite, githubId }, key, now = Date.now()) {
  const parsed = readGithubState(state, key, now);
  if (!parsed || !nonce || parsed.nonce !== String(nonce)) return { ok: false };
  const id = String(githubId || "").trim();
  if (!invite || invite.status === "revoked" || !/^\d+$/.test(id)) return { ok: false };
  if (String(invite.githubUserId || "") !== id) return { ok: false };
  if (parsed.inviteId !== invite.id) return { ok: false };
  return { ok: true, inviteId: parsed.inviteId };
}
