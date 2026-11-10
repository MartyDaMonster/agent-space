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
import { inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("invite") || "";
  const session = await auth();
  const invite = await inviteCard(inviteId);
  const githubId = String(session?.user?.githubId || "");
  if (!invite || invite.status === "revoked" || invite.status !== "accepted" || !/^\d+$/.test(githubId) || String(invite.githubUserId || "") !== githubId) {
    return NextResponse.json({ error: "That invite is not open." }, { status: 404 });
  }
  if (!githubAppConfigured()) {
    return NextResponse.redirect(new URL(`/join/${inviteId}/github?repo=waiting`, url.origin));
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
