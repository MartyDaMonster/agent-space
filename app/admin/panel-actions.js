"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createAdminInvite,
  resendAdminInvite,
  revokeAdminInvite,
  revokeAdminKey,
  setSuspension
} from "@/lib/admin-store";

async function refresh(result) {
  if (result?.ok) revalidatePath("/admin");
  return result?.ok ? { ok: true } : { error: result?.error || "Not found." };
}

export async function sendAdminInvite(formData) {
  return refresh(await createAdminInvite(await auth(), {
    workspaceId: String(formData.get("workspaceId") || ""),
    email: String(formData.get("email") || ""),
    githubLogin: String(formData.get("githubLogin") || "")
  }));
}

export async function resendInvite(formData) {
  return refresh(await resendAdminInvite(await auth(), String(formData.get("inviteId") || "")));
}

export async function revokeInviteAction(formData) {
  return refresh(await revokeAdminInvite(await auth(), String(formData.get("inviteId") || "")));
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
