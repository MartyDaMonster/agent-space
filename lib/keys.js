import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function tokenHash(token) {
  return createHash("sha256").update(String(token), "utf8").digest("hex");
}

export function hashesMatch(left, right) {
  const a = Buffer.from(String(left), "utf8");
  const b = Buffer.from(String(right), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newBotToken() {
  return `btm_${randomBytes(32).toString("base64url")}`;
}

export function newKeyId() {
  return randomUUID();
}

export function bearerToken(authorization) {
  if (typeof authorization !== "string") return "";
  const match = authorization.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : "";
}
