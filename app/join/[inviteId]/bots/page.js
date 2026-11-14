import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BotSetup } from "@/components/BotSetup";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { assistantById, BOARD_LOCALE, BOARD_TIMEZONE, formatOtherBots, setupPrompt } from "@/lib/stage2";
import { avatarPickForInvite, workspaceNameForInvitee } from "@/lib/stage2";
import { ADD_BOT_PATH } from "@/lib/onboarding-exit";
import { bindDraftToSession, botsForDraft, loadDraft, saveDisplayName, saveWorkspaceStep } from "@/lib/stage2-store";
import { finishJoin } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BotsStep({ params }) {
  const { inviteId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}/github`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) redirect(`/join/${inviteId}/github`);
  const avatar = avatarPickForInvite(inviteId);
  const firstName = String(bound.invite?.name || "").trim().split(/\s+/)[0].slice(0, 24);
  try {
    await saveWorkspaceStep(inviteId, session, {
      name: bound.draft.workspaceName || workspaceNameForInvitee(bound.invite?.name),
      shape: avatar.shape,
      color: avatar.color
    });
  } catch {
    // The workspace name can be filled in later. Don't trap the invitee on a failed write.
  }
  const listed = await botsForDraft(inviteId, session);
  if (!listed.ok || !listed.bots?.length) redirect(ADD_BOT_PATH);
  try {
    await saveDisplayName(inviteId, session, firstName);
  } catch {
    // The board still opens with the GitHub name.
  }
  const draft = await loadDraft(inviteId);
  const secrets = {};
  const prompts = Object.fromEntries((draft.assistants || []).map((id) => {
    const assistant = assistantById(id);
    return [assistant?.slug || id, setupPrompt({
      botName: assistant?.name || id,
      workspaceName: draft.workspaceName,
      repo: draft.repoName,
      assistantId: id,
      slug: assistant?.slug || id,
      ownerName: firstName || "you",
      otherBots: formatOtherBots(draft.assistants, id, assistantById),
      locale: BOARD_LOCALE,
      timezone: BOARD_TIMEZONE,
      assistantIds: draft.assistants
    })];
  }));
  return (
    <OnboardingFrame>
      {draft?.repoStatus === "waiting" ? (
        <p className="secret-note">GitHub sign-in is done. The private repo is skipped for now.</p>
      ) : null}
      <BotSetup
        inviteId={inviteId}
        bots={listed.bots}
        prompts={prompts}
        secrets={secrets}
        finish={finishJoin}
      />
    </OnboardingFrame>
  );
}
