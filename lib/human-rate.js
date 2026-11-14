import { allowRate } from "./request-limit.js";

export const HUMAN_UPLOAD_LIMIT = 30;
export const INVITE_ACTION_LIMIT = 10;

export function allowHumanUpload(id, now = Date.now()) {
  const key = String(id || "").trim();
  if (!key) return false;
  return allowRate(`upload:${key}`, HUMAN_UPLOAD_LIMIT, 60_000, now);
}

export function allowInviteAction(id, now = Date.now()) {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return false;
  return allowRate(`invite:${key}`, INVITE_ACTION_LIMIT, 60_000, now);
}
