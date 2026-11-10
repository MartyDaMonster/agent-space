import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { continueWithGitHub } from "@/app/join/actions";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { avatarPickForInvite, workspaceNameForInvitee } from "@/lib/stage2";
import {
  bindDraftToSession,
  inviteCard,
  markIntroSeen,
  saveWorkspaceStep
} from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

function ConnectForm({ inviteId, signedIn, startHref }) {
  if (!signedIn) {
    return (
      <form action={continueWithGitHub} className="onboard-actions">
        <input type="hidden" name="inviteId" value={inviteId} />
        <input type="hidden" name="assistant" value="claude" />
        <input type="hidden" name="assistant" value="grok" />
        <button className="btn" type="submit">Connect GitHub</button>
      </form>
    );
  }
  return (
    <div className="onboard-actions">
      <a className="btn" href={startHref}>Connect GitHub</a>
    </div>
  );
}

export default async function GithubStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  if (!session?.user) {
    return (
      <OnboardingFrame>
        <h1>Connect GitHub</h1>
        <p>This creates the one private repo your bots will use.</p>
        <ConnectForm inviteId={inviteId} signedIn={false} />
      </OnboardingFrame>
    );
  }
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  const ready = query?.repo === "created" || query?.repo === "exists" || bound.draft.repoStatus === "created";
  if (ready) redirect(`/join/${inviteId}/bots`);
  const avatar = avatarPickForInvite(inviteId);
  const workspaceName = bound.draft.workspaceName || workspaceNameForInvitee(bound.invite?.name);
  await saveWorkspaceStep(inviteId, session, {
    name: workspaceName,
    shape: avatar.shape,
    color: avatar.color
  });
  await markIntroSeen(inviteId);
  return (
    <OnboardingFrame>
      <h1>Connect GitHub</h1>
      <p>This creates the one private repo your bots will use.</p>
      <ConnectForm inviteId={inviteId} signedIn startHref={`/api/github/start?invite=${inviteId}`} />
    </OnboardingFrame>
  );
}
