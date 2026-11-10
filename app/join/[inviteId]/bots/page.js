import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { BotSetup } from "@/components/BotSetup";
import { OnboardArt } from "@/components/OnboardArt";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { assistantById, setupPrompt } from "@/lib/stage2";
import { botsForDraft, ensureBots, loadDraft } from "@/lib/stage2-store";
import { finishJoin, renewBotKey } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BotsStep({ params }) {
  const { inviteId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}`);
  const ready = await ensureBots(inviteId, session);
  if (!ready.ok) notFound();
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
    <OnboardingFrame step={4}>
      <OnboardArt variant="setup" bots={listed.bots} />
      <h1>Set up your bots</h1>
      <p>Almost done. Just copy the instructions and secret code to each bot, and they’ll connect themselves.</p>
      <BotSetup
        inviteId={inviteId}
        workspaceName={draft.workspaceName}
        repo={draft.repoName}
        bots={listed.bots}
        prompts={prompts}
        secrets={secrets}
        regenerate={regenerate}
        finish={finishJoin}
      />
    </OnboardingFrame>
  );
}
