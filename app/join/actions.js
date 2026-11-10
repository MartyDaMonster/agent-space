"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { auth } from "@/auth";
import {
  ensureBots,
  finishOnboardingDraft,
  markRepo,
  regenerateBotKey,
  saveAssistantChoice,
  saveDisplayName,
  saveWorkspaceStep
} from "@/lib/stage2-store";
import { githubAppConfigured } from "@/lib/stage2";
import { INVITE_COOKIE, inviteCookieOptions, signInviteCookie } from "@/lib/invite-cookie";

export async function continueWithGitHub(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const saved = await saveAssistantChoice(inviteId, formData.getAll("assistant"));
  if (!saved.ok) return { error: saved.error };
  const jar = await cookies();
  jar.set(INVITE_COOKIE, signInviteCookie(inviteId), inviteCookieOptions());
  await signIn("github", { redirectTo: `/join/${inviteId}/github` });
}

export async function saveWorkspace(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const session = await auth();
  const saved = await saveWorkspaceStep(inviteId, session, {
    name: formData.get("name"),
    shape: formData.get("shape") || "square",
    color: formData.get("color") || "lime"
  });
  if (!saved.ok) return { error: saved.error };
  const ready = await ensureBots(inviteId, session);
  if (!ready.ok) return { error: ready.error };
  await saveDisplayName(inviteId, session, formData.get("displayName"));
  redirect(`/join/${inviteId}/bots`);
}

export async function skipAvatar(formData) {
  formData.set("shape", "square");
  formData.set("color", "lime");
  await saveWorkspace(formData);
}

export async function renewBotKey(inviteId, slug) {
  const session = await auth();
  const renewed = await regenerateBotKey(inviteId, session, slug);
  if (!renewed.ok) return { error: renewed.error };
  return { token: renewed.token, last4: renewed.last4 };
}

export async function finishJoin(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const session = await auth();
  const done = await finishOnboardingDraft(inviteId, session);
  if (!done.ok) return { error: done.error };
  redirect("/");
}

export async function noteRepoWaiting(inviteId) {
  const session = await auth();
  if (!githubAppConfigured()) {
    await markRepo(inviteId, session, { status: "waiting", name: "" });
  }
}
