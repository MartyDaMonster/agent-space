import { redirect } from "next/navigation";
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
  const ready = await ensureBots(inviteId, session);
  const listed = ready.ok ? await botsForDraft(inviteId, session) : { ok: false };
  if (!ready.ok || !listed.ok) {
    return (
      <OnboardingFrame>
        <h1>Set up your bots</h1>
        <p>{ready.error || "We couldn't set up the bots yet."}</p>
        <div className="onboard-actions">
          <a className="btn" href={`/join/${inviteId}/bots`}>Try again</a>
          <a className="btn btn-skip" href="/">Go to the board</a>
        </div>
      </OnboardingFrame>
    );
  }
  try {
    await saveDisplayName(inviteId, session, firstName);
  } catch {
    // The board still opens with the GitHub name.
  }
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
      {draft?.repoStatus === "waiting" ? (
        <p className="secret-note">GitHub sign-in is done. The private repo is skipped for now.</p>
      ) : null}
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
