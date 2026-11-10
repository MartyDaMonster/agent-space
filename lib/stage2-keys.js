import { randomBytes } from "node:crypto";

export function newLiveKey() {
  const token = `bmk_live_${randomBytes(18).toString("base64url")}`;
  return { token, last4: token.slice(-4) };
}
