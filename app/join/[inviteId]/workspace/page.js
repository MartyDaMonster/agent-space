import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AvatarChoice } from "@/components/AvatarChoice";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { bindDraftToSession, ensureBots, saveWorkspaceStep } from "@/lib/stage2-store";
import { saveWorkspace } from "../../actions";

export const dynamic = "force-dynamic";

export default async function WorkspaceStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  if (query?.skip === "1") {
    const saved = await saveWorkspaceStep(inviteId, session, {
      name: bound.draft.workspaceName,
      shape: "square",
      color: "lime"
    });
    if (saved.ok) {
      await ensureBots(inviteId, session);
      redirect(`/join/${inviteId}/bots`);
    }
  }
  return (
    <OnboardingFrame
      step={3}
      skip={<Link href={`/join/${inviteId}/workspace?skip=1`}>Skip avatar</Link>}
    >
      <h1>Pick your avatar</h1>
      <p>Choose a shape and a colour. This is how you&apos;ll appear on the board.</p>
      <form action={saveWorkspace}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <AvatarChoice />
        <button className="btn" type="submit">Continue</button>
      </form>
    </OnboardingFrame>
  );
}
