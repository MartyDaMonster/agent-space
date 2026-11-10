"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { insertInvite, revokeStoredInvite } from "@/lib/invites";
import { authorizeInviteCreate } from "@/lib/workspace";
import { sessionHasBoard, workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";

async function owner() {
  const session = await auth();
  if (!(await sessionHasBoard(session))) return null;
  const workspaceId = await workspaceIdForSession(session);
  const role = await workspaceRole(session, workspaceId);
  const allowed = authorizeInviteCreate({ actorWorkspace: workspaceId, actorRole: role, workspaceId });
  if (!allowed.ok) return null;
  return { session, workspaceId };
}

export async function sendPersonInvite(formData) {
  const actor = await owner();
  if (!actor) return { error: "You need to own this workspace." };
  const raw = String(formData.get("invitee") || "").trim();
  const email = raw.includes("@") ? raw : "";
  const githubLogin = email ? "" : raw.replace(/^@/, "");
  const created = await insertInvite({
    id: `inv-${randomBytes(6).toString("hex")}`,
    workspaceId: actor.workspaceId,
    email,
    githubLogin,
    createdBy: actor.session.user?.email || actor.session.user?.githubLogin || "owner"
  });
  if (!created.ok) return { error: created.error };
  revalidatePath("/invite");
  return { ok: true };
}

export async function revokePersonInvite(formData) {
  const actor = await owner();
  if (!actor) return { error: "You need to own this workspace." };
  const revoked = await revokeStoredInvite(actor.workspaceId, String(formData.get("inviteId") || ""));
  if (!revoked.ok) return { error: revoked.error || "That invite is not open." };
  revalidatePath("/invite");
  return { ok: true };
}
