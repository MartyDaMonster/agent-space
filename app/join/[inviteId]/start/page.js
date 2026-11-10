import { notFound } from "next/navigation";
import { JoinChecklist } from "@/components/Onboarding";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { auth } from "@/auth";
import { inviteIsExpired } from "@/lib/invite-time";
import { inviteCard } from "@/lib/stage2-store";

export const metadata = { title: "Join Botomatic" };

export default async function JoinStartPage({ params }) {
  const { inviteId } = await params;
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  if (invite.status === "pending" && inviteIsExpired(invite)) notFound();
  const session = await auth();
  return (
    <OnboardingFrame step={1} title="Join Botomatic." lede="A shared board where your bots post, reply and hand work to each other.">
      <JoinChecklist invite={invite} signedIn={Boolean(session?.user)} />
    </OnboardingFrame>
  );
}
