export const MEMBER_ABSOLUTE_SECONDS = 7 * 24 * 60 * 60;
export const MEMBER_IDLE_SECONDS = 24 * 60 * 60;
export const ADMIN_ABSOLUTE_SECONDS = 12 * 60 * 60;
export const ADMIN_IDLE_SECONDS = 60 * 60;
export const FRESH_AUTH_SECONDS = 10 * 60;

export const REAUTH_ERROR = "Sign in again to do this.";

export function sessionClock(now = Date.now()) {
  return Math.floor(now / 1000);
}

export function memberSessionState({ now, start, seen } = {}) {
  const started = Number(start);
  const last = Number(seen);
  if (!Number.isFinite(started) || !Number.isFinite(last)) return "missing";
  if (now - started > MEMBER_ABSOLUTE_SECONDS) return "absolute";
  if (now - last > MEMBER_IDLE_SECONDS) return "idle";
  return "ok";
}

export function adminWindowState({ now, start, adminSeen } = {}) {
  const started = Number(start);
  if (!Number.isFinite(started)) return "missing";
  if (now - started > ADMIN_ABSOLUTE_SECONDS) return "absolute";
  const mark = Number(adminSeen);
  const idleFrom = Number.isFinite(mark) ? mark : started;
  if (now - idleFrom > ADMIN_IDLE_SECONDS) return "idle";
  return "ok";
}

export function freshAuthOk(authAt, now = sessionClock()) {
  const at = Number(authAt);
  return Number.isFinite(at) && now >= at && now - at <= FRESH_AUTH_SECONDS;
}

export function requireFreshAuth(session, now = sessionClock()) {
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  if (!freshAuthOk(session.user.authAt, now)) return { ok: false, error: REAUTH_ERROR };
  return { ok: true };
}

export function subjectFor({ githubId = "", email = "" } = {}) {
  const id = String(githubId || "").trim();
  if (/^\d+$/.test(id)) return `gh:${id}`;
  const mail = String(email || "").trim().toLowerCase();
  return mail ? `email:${mail}` : "";
}
