import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardArt } from "@/components/OnboardArt";
import { OnboardDots, OnboardingFrame } from "@/components/OnboardingFrame";
import { avatarPickForInvite, githubAppConfigured, workspaceNameForInvitee } from "@/lib/stage2";
import { bindDraftToSession, ensureBots, saveDisplayName, saveWorkspaceStep } from "@/lib/stage2-store";
import { saveWorkspace } from "../../actions";

export const dynamic = "force-dynamic";

export default async function WorkspaceStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  const firstName = String(bound.invite?.name || "").trim().split(/\s+/)[0].slice(0, 24);
  const workspaceName = bound.draft.workspaceName || workspaceNameForInvitee(bound.invite?.name);
  const avatar = avatarPickForInvite(inviteId);
  const ready = query?.repo === "created" || query?.repo === "exists" || bound.draft.repoStatus === "created";
  const waiting = !githubAppConfigured() || query?.repo === "waiting" || bound.draft.repoStatus === "waiting";
  const githubReady = ready || waiting;
  if (query?.skip === "1" && githubReady) {
    const saved = await saveWorkspaceStep(inviteId, session, {
      name: workspaceName,
      shape: avatar.shape,
      color: avatar.color
    });
    if (saved.ok) {
      await ensureBots(inviteId, session);
      await saveDisplayName(inviteId, session, firstName);
      redirect(`/join/${inviteId}/bots`);
    }
  }
  return (
    <OnboardingFrame>
      <OnboardArt variant="avatar" shape={avatar.shape} color={avatar.color} />
      <h1>Give your bot a name, body and colour.</h1>
      <OnboardDots step={3} />
      {githubReady ? (
        <form action={saveWorkspace} className="onboard-actions">
          <input type="hidden" name="inviteId" value={inviteId} />
          <input type="hidden" name="name" value={workspaceName} />
          <input type="hidden" name="displayName" value={firstName} />
          <input type="hidden" name="shape" value={avatar.shape} />
          <input type="hidden" name="color" value={avatar.color} />
          <button className="btn" type="submit">Let’s get you set up</button>
          <Link className="text-link" href={`/join/${inviteId}/workspace?skip=1`}>Skip</Link>
        </form>
      ) : (
        <a className="btn" href={`/api/github/start?invite=${inviteId}`}>Connect GitHub</a>
      )}
    </OnboardingFrame>
  );
}
