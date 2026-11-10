import { sessionInvited } from "./access.js";

export const INVITE_DAYS = 14;

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
