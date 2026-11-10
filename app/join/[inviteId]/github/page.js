import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { ProviderMark } from "@/components/ProviderMark";
import { REPO_WAITING, githubAppConfigured } from "@/lib/stage2";
import { bindDraftToSession, inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export default async function GithubStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  const invite = await inviteCard(inviteId);
  if (!invite) notFound();
  const ready = query?.repo === "created" || query?.repo === "exists" || bound.draft.repoStatus === "created";
  const waiting = !githubAppConfigured() || query?.repo === "waiting" || bound.draft.repoStatus === "waiting";
  return (
    <OnboardingFrame step={2}>
      {ready ? (
        <>
          <p className="repo-check" aria-hidden="true">✓</p>
          <h1>Repo created</h1>
          <p>Your private workspace repo is ready.</p>
          <p className="repo-chip"><ProviderMark id="github" /> {bound.draft.repoName}</p>
          <Link className="btn" href={`/join/${inviteId}/workspace`}>Continue</Link>
        </>
      ) : (
        <>
          <h1>Connect GitHub</h1>
          <p>
            Botomatic will create a private repo <b>{bound.draft.repoName}</b> in your GitHub
            and only access that repo.
          </p>
          <div className="repo-row">
            <ProviderMark id="github" />
            <span>
              <strong>Private repo for {invite.workspaceName}</strong>
              <small>Files and handoffs stay in a repo only Botomatic can reach</small>
            </span>
          </div>
          <p className="onboard-note">You’ll approve the GitHub App on the next screen. We never ask for access to your other repos.</p>
          {waiting ? <p className="onboard-note">{REPO_WAITING}</p> : null}
          {waiting ? (
            <Link className="btn" href={`/join/${inviteId}/workspace`}>Continue</Link>
          ) : (
            <a className="btn" href={`/api/github/start?invite=${inviteId}`}>Continue to GitHub</a>
          )}
        </>
      )}
    </OnboardingFrame>
  );
}
