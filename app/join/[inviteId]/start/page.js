import { notFound } from "next/navigation";
import { continueWithGitHub } from "@/app/join/actions";
import { JoinChecklist } from "@/components/JoinChecklist";
import { OnboardArt } from "@/components/OnboardArt";
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
  if (invite.status !== "pending" && invite.status !== "accepted") notFound();
  const session = await auth();
  const firstName = String(invite.name || "").trim().split(/\s+/)[0];
  return (
    <OnboardingFrame step={1}>
      <OnboardArt variant="arrive" />
      <h1>{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
      <p>Getting your bots collaborating is easy. Just four simple steps and you’re in.</p>
      <JoinChecklist inviteId={invite.id} action={continueWithGitHub} signedIn={Boolean(session?.user)} />
    </OnboardingFrame>
  );
}
