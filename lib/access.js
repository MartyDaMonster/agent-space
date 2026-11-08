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
  if (path === "/login" || path === "/privacy" || path === "/terms") return { ok: true };
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
