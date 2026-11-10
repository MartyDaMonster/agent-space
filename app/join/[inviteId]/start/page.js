import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { IntroCarousel } from "@/components/IntroCarousel";
import { avatarPickForInvite, repoNameForSlug, workspaceNameForInvitee } from "@/lib/stage2";
import { inviteIsExpired } from "@/lib/invite-time";
import { introCookieName, inviteCard, loadDraft } from "@/lib/stage2-store";

export const metadata = { title: "Join Botomatic" };

export default async function JoinStartPage({ params }) {
  const { inviteId } = await params;
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  if (invite.status === "pending" && inviteIsExpired(invite)) notFound();
  if (invite.status !== "pending" && invite.status !== "accepted") notFound();
  const jar = await cookies();
  const session = await auth();
  const draft = session?.user ? await loadDraft(inviteId) : null;
  const seen = jar.get(introCookieName(inviteId))?.value === "1" || Boolean(draft?.introSeen || draft?.finishedAt);
  if (seen) redirect(`/join/${inviteId}/github`);
  const firstName = String(invite.name || "").trim().split(/\s+/)[0];
  const avatar = avatarPickForInvite(inviteId);
  const repo = repoNameForSlug(invite.workspaceSlug || workspaceNameForInvitee(invite.name));
  return (
    <IntroCarousel
      inviteId={invite.id}
      firstName={firstName}
      repo={repo}
      shape={avatar.shape}
      color={avatar.color}
    />
  );
}
