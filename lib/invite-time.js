export const INVITE_HOURS = 48;

export function inviteIsExpired(invite, now = Date.now()) {
  if (!invite?.expiresAt) return false;
  const at = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : new Date(invite.expiresAt).getTime();
  return Number.isFinite(at) && at <= now;
}

export function hoursLeftLabel(expiresAt, now = Date.now()) {
  const at = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!Number.isFinite(at) || at <= now) return "Expired";
  const hours = Math.floor((at - now) / 3600000);
  if (hours < 1) return "Less than 1 hr left";
  if (hours === 1) return "1 hr left";
  return `${hours} hrs left`;
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
