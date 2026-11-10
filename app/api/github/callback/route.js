import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPrivateRepo, exchangeGithubCode } from "@/lib/github-app";
import {
  acceptGithubState,
  GITHUB_STATE_COOKIE,
  githubStateCookieOptions,
  readGithubState
} from "@/lib/github-state";
import { githubAppConfigured } from "@/lib/stage2";
import { inviteCard, markRepo } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const session = await auth();
  const state = url.searchParams.get("state") || "";
  const nonce = jar.get(GITHUB_STATE_COOKIE)?.value || "";
  const parsed = readGithubState(state);
  const invite = parsed ? await inviteCard(parsed.inviteId) : null;
  const allowed = acceptGithubState({
    state,
    nonce,
    invite,
    githubId: session?.user?.githubId || ""
  });
  jar.set(GITHUB_STATE_COOKIE, "", { ...githubStateCookieOptions(), maxAge: 0 });
  if (!allowed.ok || !invite) {
    return NextResponse.json({ error: "That invite is not open." }, { status: 404 });
  }
  const inviteId = allowed.inviteId;
  if (!githubAppConfigured()) {
    return NextResponse.redirect(new URL(`/join/${inviteId}/github?repo=waiting`, url.origin));
  }
  const token = await exchangeGithubCode({
    code: url.searchParams.get("code") || "",
    redirectUri: `${url.origin}/api/github/callback`
  });
  const created = token
    ? await createPrivateRepo({
      token,
      workspaceSlug: invite.workspaceSlug,
      workspaceName: invite.workspaceName
    })
    : { status: "failed", name: "" };
  if (session?.user) {
    await markRepo(inviteId, session, {
      status: created.status === "created" || created.status === "exists" ? "created" : "failed",
      name: created.name
    });
  }
  const repo = created.status === "created" || created.status === "exists" ? "created" : "failed";
  return NextResponse.redirect(new URL(`/join/${inviteId}/github?repo=${repo}`, url.origin));
}
