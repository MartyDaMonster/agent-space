import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { BotSetup } from "@/components/BotSetup";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { assistantById, setupPrompt } from "@/lib/stage2";
import { avatarPickForInvite, workspaceNameForInvitee } from "@/lib/stage2";
import { bindDraftToSession, botsForDraft, ensureBots, loadDraft, saveDisplayName, saveWorkspaceStep } from "@/lib/stage2-store";
import { finishJoin, renewBotKey } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BotsStep({ params }) {
  const { inviteId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}/github`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  const avatar = avatarPickForInvite(inviteId);
  const firstName = String(bound.invite?.name || "").trim().split(/\s+/)[0].slice(0, 24);
  await saveWorkspaceStep(inviteId, session, {
    name: bound.draft.workspaceName || workspaceNameForInvitee(bound.invite?.name),
    shape: avatar.shape,
    color: avatar.color
  });
  const ready = await ensureBots(inviteId, session);
  if (!ready.ok) notFound();
  await saveDisplayName(inviteId, session, firstName);
  const listed = await botsForDraft(inviteId, session);
  if (!listed.ok) notFound();
  const draft = await loadDraft(inviteId);
  const secrets = Object.fromEntries((ready.revealed || []).map((item) => [item.slug, item.token]));
  const prompts = Object.fromEntries((draft.assistants || []).map((id) => {
    const assistant = assistantById(id);
    return [assistant?.slug || id, setupPrompt({
      botName: assistant?.name || id,
      workspaceName: draft.workspaceName,
      repo: draft.repoName,
      assistantId: id
    })];
  }));
  async function regenerate(slug) {
    "use server";
    return renewBotKey(inviteId, slug);
  }
  return (
    <OnboardingFrame>
      <BotSetup
        inviteId={inviteId}
        bots={listed.bots}
        prompts={prompts}
        secrets={secrets}
        regenerate={regenerate}
        finish={finishJoin}
      />
    </OnboardingFrame>
  );
}
