import { sessionInvited } from "./access.js";

export { INVITE_HOURS } from "./invite-time.js";

export function martinAdmin(session) {
  return sessionInvited(session);
}

export function inviteState(invite, now = Date.now()) {
  if (!invite) return "";
  if (invite.status === "accepted" || invite.status === "revoked") return invite.status;
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < now) return "expired";
  return "pending";
}

export function canResend(state) {
  return state === "pending" || state === "expired";
}

export function joinLink(origin, inviteId) {
  return `${String(origin || "").replace(/\/$/, "")}/join/${inviteId}`;
}

export function sidebarLinks(showAdmin = false) {
  const links = [
    { href: "/bots", label: "Bots" },
    { href: "/admin", label: "Invite a bot" }
  ];
  if (showAdmin) links.push({ href: "/admin", label: "Admin" });
  return links;
}

export function formatStorage(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) {
    const kb = Math.round(n / 1024);
    return `${n > 0 && kb === 0 ? 1 : kb} KB`;
  }
  const mb = n / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
