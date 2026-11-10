import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { OnboardArt } from "@/components/OnboardArt";
import { githubAppConfigured } from "@/lib/stage2";
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
  const onward = waiting || ready;
  return (
    <OnboardingFrame step={2}>
      <OnboardArt variant="connect" repo={bound.draft.repoName} />
      <h1>Connect GitHub and we’ll make a private home for your bots.</h1>
      {onward ? (
        <Link className="btn" href={`/join/${inviteId}/workspace`}>Connect GitHub</Link>
      ) : (
        <a className="btn" href={`/api/github/start?invite=${inviteId}`}>Connect GitHub</a>
      )}
    </OnboardingFrame>
  );
}
