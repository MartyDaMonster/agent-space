"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/auth";
import {
  createAdminInvite,
  resendAdminInvite,
  sendAdminTestEmail,
  revokeAdminInvite,
  revokeAdminKey,
  setSuspension
} from "@/lib/admin-store";

async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "botomatic.dev";
  const proto = headerList.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

async function refresh(result) {
  if (result?.ok) revalidatePath("/admin");
  if (!result?.ok) return { error: result?.error || "Not found." };
  return { ok: true, notice: result.notice || "" };
}

export async function sendAdminInvite(_previous, formData) {
  return refresh(await createAdminInvite(await auth(), {
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || "")
  }, { origin: await requestOrigin() }));
}

export async function sendInviteTest() {
  const session = await auth();
  return refresh(await sendAdminTestEmail(session, { origin: await requestOrigin() }));
}

export async function resendInvite(formData) {
  return refresh(await resendAdminInvite(await auth(), String(formData.get("inviteId") || ""), {
    origin: await requestOrigin()
  }));
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
