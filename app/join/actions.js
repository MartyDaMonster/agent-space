"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { signIn } from "@/auth";
import { auth } from "@/auth";
import {
  finishOnboardingDraft,
  inviteCard,
  markRepo,
  regenerateBotKey,
  saveAssistantChoice,
  introCookieName,
  saveDisplayName,
  saveWorkspaceStep
} from "@/lib/stage2-store";
import { githubAppConfigured } from "@/lib/stage2";
import { inviteIsExpired } from "@/lib/invite-time";
import { ADD_BOT_PATH, completeEducationalOnboarding } from "@/lib/onboarding-exit";
import { requireFreshAuth } from "@/lib/session-policy";
import { INVITE_COOKIE, inviteCookieOptions, signInviteCookie } from "@/lib/invite-cookie";

export async function finishIntro(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const jar = await cookies();
  jar.set(introCookieName(inviteId), "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90
  });
  const session = await auth();
  await completeEducationalOnboarding(inviteId, session);
  if (!session?.user) {
    jar.set(INVITE_COOKIE, signInviteCookie(inviteId), inviteCookieOptions());
    await signIn("github", { redirectTo: ADD_BOT_PATH });
  }
  redirect(ADD_BOT_PATH);
}

export async function continueWithGitHub(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  if (invite.status === "pending") {
    if (inviteIsExpired(invite)) notFound();
    const picked = formData.getAll("assistant").map((item) => String(item || "")).filter(Boolean);
    if (picked.length) {
      const saved = await saveAssistantChoice(inviteId, picked);
      if (!saved.ok) return { error: saved.error };
    }
  } else if (invite.status !== "accepted") {
    notFound();
  }
  const jar = await cookies();
  jar.set(INVITE_COOKIE, signInviteCookie(inviteId), inviteCookieOptions());
  await signIn("github", { redirectTo: ADD_BOT_PATH });
}

export async function saveWorkspace(formData) {
  const inviteId = String(formData.get("inviteId") || "");
  const session = await auth();
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { error: fresh.error };
  const saved = await saveWorkspaceStep(inviteId, session, {
    name: formData.get("name"),
    shape: formData.get("shape") || "square",
    color: formData.get("color") || "lime"
  });
  if (!saved.ok) return { error: saved.error };
  await saveDisplayName(inviteId, session, formData.get("displayName"));
  redirect(ADD_BOT_PATH);
}

export async function skipAvatar(formData) {
  formData.set("shape", "square");
  formData.set("color", "lime");
  await saveWorkspace(formData);
}

export async function renewBotKey(inviteId, slug) {
  const session = await auth();
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { error: fresh.error };
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
