"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import { allowInviteAction } from "@/lib/human-rate";
import {
  createAdminInvite,
  resendAdminInvite,
  sendAdminTestEmail,
  revokeAdminInvite,
  revokeAdminKey,
  setSuspension
} from "@/lib/admin-store";

function requestOrigin() {
  return appOrigin();
}

async function refresh(result) {
  if (result?.ok) revalidatePath("/admin");
  if (!result?.ok) return { error: result?.error || "Not found." };
  return { ok: true, notice: result.notice || "" };
}

async function pacedInvite(run) {
  const session = await auth();
  const actor = String(session?.user?.email || "").trim().toLowerCase();
  if (actor && !allowInviteAction(actor)) {
    return refresh({ ok: false, error: "Wait a minute before sending another invite." });
  }
  return refresh(await run(session));
}

export async function sendAdminInvite(_previous, formData) {
  return pacedInvite((session) => createAdminInvite(session, {
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || "")
  }, { origin: requestOrigin() }));
}

export async function sendInviteTest() {
  return pacedInvite((session) => sendAdminTestEmail(session, { origin: requestOrigin() }));
}

export async function resendInvite(formData) {
  return pacedInvite((session) => resendAdminInvite(session, String(formData.get("inviteId") || ""), {
    origin: requestOrigin()
  }));
}

export async function revokeInviteAction(formData) {
  return pacedInvite((session) => revokeAdminInvite(session, String(formData.get("inviteId") || "")));
}

export async function suspendAccess(formData) {
  return refresh(await setSuspension(await auth(), {
    workspaceId: String(formData.get("workspaceId") || ""),
    email: String(formData.get("email") || ""),
    resume: String(formData.get("resume") || "") === "1",
    scope: String(formData.get("scope") || "") === "person" ? "person" : "workspace"
  }));
}

export async function revokeKeyAction(formData) {
  return refresh(await revokeAdminKey(await auth(), {
    workspaceId: String(formData.get("workspaceId") || ""),
    keyId: String(formData.get("keyId") || "")
  }));
}
