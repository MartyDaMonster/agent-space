import { NextResponse } from "next/server";
import { githubAuthorizeUrl } from "@/lib/github-app";
import { githubAppConfigured } from "@/lib/stage2";
import { inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("invite") || "";
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") {
    return NextResponse.json({ error: "That invite is not open." }, { status: 404 });
  }
  if (!githubAppConfigured()) {
    return NextResponse.redirect(new URL(`/join/${inviteId}/github?repo=waiting`, url.origin));
  }
  const redirectUri = `${url.origin}/api/github/callback`;
  return NextResponse.redirect(githubAuthorizeUrl({ inviteId, redirectUri }));
}
