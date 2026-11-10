import { notFound } from "next/navigation";
import { JoinChecklist } from "@/components/JoinChecklist";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { inviteCard } from "@/lib/stage2-store";
import { continueWithGitHub } from "../actions";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }) {
  const { inviteId } = await params;
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  return (
    <OnboardingFrame step={1}>
      <h1>You’ve been invited to {invite.workspaceName}</h1>
      <p>Invited by <b>{invite.createdBy}</b>.</p>
      <JoinChecklist inviteId={inviteId} action={continueWithGitHub} />
    </OnboardingFrame>
  );
}
