import { randomBytes } from "node:crypto";

export function newInviteId() {
  return `inv-${randomBytes(16).toString("base64url")}`;
}

export function newWorkspaceId() {
  return `ws-${randomBytes(8).toString("hex")}`;
}
