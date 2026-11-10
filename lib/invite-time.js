export const INVITE_HOURS = 48;

export function inviteIsExpired(invite, now = Date.now()) {
  if (!invite?.expiresAt) return false;
  const at = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : new Date(invite.expiresAt).getTime();
  return Number.isFinite(at) && at <= now;
}

export function remainingParts(expiresAt, now = Date.now()) {
  const at = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  const left = Math.max(0, at - now);
  const total = Math.floor(left / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return {
    left,
    expired: left <= 0,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0")
  };
}
