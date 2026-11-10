import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPrivateRepo, exchangeGithubCode } from "@/lib/github-app";
import { githubAppConfigured } from "@/lib/stage2";
import { inviteCard, markRepo } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("state") || "";
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") {
    return NextResponse.json({ error: "That invite is not open." }, { status: 404 });
  }
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
  const session = await auth();
  if (session?.user) {
    await markRepo(inviteId, session, {
      status: created.status === "created" || created.status === "exists" ? "created" : "failed",
      name: created.name
    });
  }
  const repo = created.status === "created" || created.status === "exists" ? "created" : "failed";
  return NextResponse.redirect(new URL(`/join/${inviteId}/github?repo=${repo}`, url.origin));
}
