import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { bindDraftToSession, inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export default async function WorkspaceStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}/github`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) {
    const invite = await inviteCard(inviteId);
    if (!invite || invite.status === "revoked") notFound();
    redirect(`/join/${inviteId}/github`);
  }
  const ready = query?.repo === "created" || query?.repo === "exists" || bound.draft.repoStatus === "created";
  redirect(ready ? `/join/${inviteId}/bots` : `/join/${inviteId}/github`);
}
