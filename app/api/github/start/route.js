import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { githubAuthorizeUrl } from "@/lib/github-app";
import {
  GITHUB_STATE_COOKIE,
  githubStateCookieOptions,
  newGithubNonce,
  signGithubState
} from "@/lib/github-state";
import { githubAppConfigured } from "@/lib/stage2";
import { ADD_BOT_PATH } from "@/lib/onboarding-exit";
import { inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("invite") || "";
  const session = await auth();
  const invite = await inviteCard(inviteId);
  const githubId = String(session?.user?.githubId || "");
  if (!invite || invite.status === "revoked" || invite.status !== "accepted" || !/^\d+$/.test(githubId) || String(invite.githubUserId || "") !== githubId) {
    const back = inviteId ? `/join/${encodeURIComponent(inviteId)}/github` : "/login";
    return NextResponse.redirect(new URL(back, url.origin));
  }
  if (!githubAppConfigured()) {
    return NextResponse.redirect(new URL(ADD_BOT_PATH, url.origin));
  }
  const nonce = newGithubNonce();
  const jar = await cookies();
  jar.set(GITHUB_STATE_COOKIE, nonce, githubStateCookieOptions());
  const redirectUri = `${url.origin}/api/github/callback`;
  return NextResponse.redirect(githubAuthorizeUrl({
    state: signGithubState({ inviteId, nonce }),
    redirectUri
  }));
}
