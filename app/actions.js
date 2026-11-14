"use server";

import { auth, signIn, signOut } from "@/auth";
import { bumpSubject, subjectFromToken } from "@/lib/session-store";

function safeNext(value) {
  const next = String(value || "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInWithGoogle(formData) {
  await signIn("google", { redirectTo: safeNext(formData?.get?.("next")) });
}

export async function signInWithGitHub(formData) {
  await signIn("github", { redirectTo: safeNext(formData?.get?.("next")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function signOutEverywhereAction() {
  const session = await auth();
  const subject = subjectFromToken({
    githubId: session?.user?.githubId || "",
    email: session?.user?.email || ""
  });
  if (subject) {
    try {
      await bumpSubject(subject);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "sign out everywhere failed");
    }
  }
  await signOut({ redirectTo: "/login" });
}
