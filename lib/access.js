export const DEFAULT_ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";
export const DEFAULT_GITHUB_IDS = "150204025";

export function emailAllowed(email, allowlist) {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const allowed = new Set(
    String(allowlist || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
  if (!allowed.size) return false;
  return allowed.has(normalized);
}

function idSet(value, fallback) {
  const source = value === undefined || value === null ? fallback : value;
  return new Set(
    String(source)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^\d+$/.test(item))
  );
}

export function githubIdAllowed(githubId, githubIds = process.env.ALLOWED_GITHUB_IDS) {
  const id = String(githubId || "").trim();
  if (!/^\d+$/.test(id)) return false;
  return idSet(githubIds, DEFAULT_GITHUB_IDS).has(id);
}

export function inviteAllowed({ email = "", emailVerified, emailSource = "", githubId = "", emails, githubIds } = {}) {
  const id = String(githubId || "").trim();
  if (id) return githubIdAllowed(id, githubIds);
  if (emailSource === "invite") return false;
  if (emailVerified === false) return false;
  const list = emails === undefined || emails === null ? DEFAULT_ALLOWED_EMAILS : emails;
  return emailAllowed(email, list);
}

export function sessionInvited(session, emails = process.env.ALLOWED_EMAILS, githubIds = process.env.ALLOWED_GITHUB_IDS) {
  return inviteAllowed({
    email: session?.user?.email || "",
    emailSource: session?.user?.emailSource || "",
    githubId: session?.user?.githubId || "",
    emails,
    githubIds
  });
}

function bearerToken(authorization) {
  if (typeof authorization !== "string") return "";
  const match = authorization.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : "";
}

export function hasAuthCookie(cookieNames) {
  return (cookieNames || []).some((name) =>
    name === "authjs.session-token"
    || name.startsWith("authjs.session-token.")
    || name === "__Secure-authjs.session-token"
    || name.startsWith("__Secure-authjs.session-token.")
  );
}

export function decideAccess({ pathname, hasSession, authorization }) {
  const path = pathname || "/";
  if (path.startsWith("/api/auth")) return { ok: true };
  if (path.startsWith("/join/") || path === "/join") return { ok: true };
  if (path.startsWith("/api/join/") || path.startsWith("/api/github/") || path.startsWith("/api/invite/")) return { ok: true };
  if (path.startsWith("/email/") || path === "/dev/invite-email" || path === "/dev/invite-countdown.gif" || path === "/dev/wordmark-frame") return { ok: true };
  if (path === "/login" || path === "/privacy" || path === "/terms" || path.startsWith("/promo/") || path.startsWith("/brand/")) return { ok: true };
  if (path.startsWith("/_vercel/insights") || path.startsWith("/_vercel/speed-insights")) return { ok: true };
  if (path === "/api/metrics/event") return { ok: true };
  if (path === "/api/cron/expire-files") return { ok: true };
  if (path === "/api/files" || path.startsWith("/api/files/")) {
    if (bearerToken(authorization)) return { ok: true, bearer: true };
    if (!hasSession) return { ok: false, status: 401 };
    return { ok: true, human: true };
  }
  if (path === "/api/metrics/daily") {
    if (bearerToken(authorization)) return { ok: true, bearer: true };
    if (!hasSession) return { ok: false, status: 401 };
    return { ok: true, human: true };
  }
  if (path.startsWith("/api/projects/") && path !== "/api/projects") {
    if (bearerToken(authorization)) return { ok: true, bearer: true };
    if (!hasSession) return { ok: false, status: 401 };
    return { ok: true, human: true };
  }
  const botApi = path === "/api/posts" || path.startsWith("/api/posts/")
    || path === "/api/bots" || path.startsWith("/api/bots/")
    || path === "/api/projects" || path.startsWith("/api/projects/");
  if (botApi) {
    if (!bearerToken(authorization)) return { ok: false, status: 401 };
    return { ok: true, bearer: true };
  }
  if (!hasSession) {
    if (path.startsWith("/api/")) return { ok: false, status: 401 };
    return { ok: false, redirect: "/login" };
  }
  return { ok: true, human: true };
}
