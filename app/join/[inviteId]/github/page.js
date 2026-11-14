import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions";
import { continueWithGitHub } from "@/app/join/actions";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { inviteIsExpired } from "@/lib/invite-time";
import { avatarPickForInvite, githubAppConfigured, workspaceNameForInvitee } from "@/lib/stage2";
import {
  bindDraftToSession,
  inviteCard,
  markIntroSeen,
  saveWorkspaceStep
} from "@/lib/stage2-store";
import { ADD_BOT_PATH } from "@/lib/onboarding-exit";

export const dynamic = "force-dynamic";

function ConnectMark() {
  return (
    <picture className="connect-mark">
      <source srcSet="/brand/botomatic-B-app-icon-colour-on-black.svg" type="image/svg+xml" />
      <img src="/brand/botomatic-B-app-icon-colour-on-black.png" alt="Botomatic" width="96" height="96" />
    </picture>
  );
}

function ConnectForm({ inviteId }) {
  return (
    <form action={continueWithGitHub} className="onboard-actions">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn" type="submit">Connect GitHub</button>
    </form>
  );
}

const connectLine = "Sign up with GitHub to continue.";

async function rememberSetup(inviteId, session, draft) {
  const avatar = avatarPickForInvite(inviteId);
  try {
    await saveWorkspaceStep(inviteId, session, {
      name: draft?.workspaceName || workspaceNameForInvitee(draft?.inviteName),
      shape: avatar.shape,
      color: avatar.color
    });
    await markIntroSeen(inviteId);
  } catch {
    // A draft write must not replace this step with a blank error page.
  }
}

export default async function GithubStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  if (inviteId === "preview") {
    return (
      <OnboardingFrame>
        <ConnectMark />
        <h1>Connect GitHub</h1>
        <p>{connectLine}</p>
        <ConnectForm inviteId={inviteId} />
      </OnboardingFrame>
    );
  }
  const session = await auth();
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  if (invite.status === "pending" && inviteIsExpired(invite)) notFound();
  if (invite.status !== "pending" && invite.status !== "accepted") notFound();

  const bound = session?.user ? await bindDraftToSession(inviteId, session) : { ok: false };
  const appReady = githubAppConfigured();

  if (bound.ok) {
    const repoReady = query?.repo === "created" || query?.repo === "exists" || bound.draft.repoStatus === "created";
    if (repoReady || !appReady || query?.repo === "waiting" || query?.repo === "skipped") {
      await rememberSetup(inviteId, session, {
        workspaceName: bound.draft.workspaceName,
        inviteName: bound.invite?.name
      });
      redirect(ADD_BOT_PATH);
    }
    await rememberSetup(inviteId, session, {
      workspaceName: bound.draft.workspaceName,
      inviteName: bound.invite?.name
    });
    return (
      <OnboardingFrame>
        <ConnectMark />
        <h1>Connect GitHub</h1>
        <p>{connectLine}</p>
        {query?.repo === "failed" ? <p>GitHub didn't finish the repo. You can try connecting again.</p> : null}
        <div className="onboard-actions">
          <a className="btn" href={`/api/github/start?invite=${inviteId}`}>Connect GitHub</a>
        </div>
      </OnboardingFrame>
    );
  }

  if (session?.user && invite.status === "accepted") {
    return (
      <OnboardingFrame>
        <ConnectMark />
        <h1>Connect GitHub</h1>
        <p>This invite is already linked to a different GitHub account. Sign out, then open your invite link again.</p>
        <div className="onboard-actions">
          <form action={signOutAction}>
            <button className="btn" type="submit">Sign out</button>
          </form>
          <a className="btn btn-skip" href="/">Go to the board</a>
        </div>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame>
      <ConnectMark />
      <h1>Connect GitHub</h1>
      <p>{connectLine}</p>
      <ConnectForm inviteId={inviteId} />
    </OnboardingFrame>
  );
}
