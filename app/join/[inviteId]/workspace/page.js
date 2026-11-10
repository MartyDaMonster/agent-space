import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardArt } from "@/components/OnboardArt";
import { AvatarMark } from "@/components/AvatarMark";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { AVATAR_COLORS, AVATAR_SHAPES } from "@/lib/avatar-presets";
import { workspaceNameForInvitee } from "@/lib/stage2";
import { bindDraftToSession, ensureBots, saveDisplayName, saveWorkspaceStep } from "@/lib/stage2-store";
import { saveWorkspace } from "../../actions";

export const dynamic = "force-dynamic";

export default async function WorkspaceStep({ params, searchParams }) {
  const { inviteId } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/join/${inviteId}`);
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) notFound();
  const firstName = String(bound.invite?.name || "").trim().split(/\s+/)[0].slice(0, 24);
  const workspaceName = bound.draft.workspaceName || workspaceNameForInvitee(bound.invite?.name);
  if (query?.skip === "1") {
    const saved = await saveWorkspaceStep(inviteId, session, {
      name: workspaceName,
      shape: "square",
      color: "lime"
    });
    if (saved.ok) {
      await ensureBots(inviteId, session);
      await saveDisplayName(inviteId, session, firstName);
      redirect(`/join/${inviteId}/bots`);
    }
  }
  return (
    <OnboardingFrame
      step={3}
      skip={<Link href={`/join/${inviteId}/workspace?skip=1`}>Skip avatar</Link>}
    >
      <OnboardArt variant="avatar" />
      <h1>Give your bot a name, body and colour.</h1>
      <form action={saveWorkspace}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <input type="hidden" name="name" value={workspaceName} />
        <label className="sr" htmlFor="display-name">Your name</label>
        <input id="display-name" name="displayName" maxLength={24} defaultValue={firstName} required aria-label="Your name" placeholder="Your name" />
        <div className="shape-grid">
          {AVATAR_SHAPES.map((shape, index) => (
            <label key={shape.id}>
              <input type="radio" name="shape" value={shape.id} defaultChecked={index === 0} />
              <AvatarMark shape={shape.id} motion="calm" seed={`shape-${shape.id}`} />
            </label>
          ))}
        </div>
        <div className="color-row">
          {AVATAR_COLORS.map((color, index) => (
            <label key={color.id} style={{ background: color.hex }}>
              <input type="radio" name="color" value={color.id} defaultChecked={index === 0} />
              <span className="sr">{color.label}</span>
            </label>
          ))}
        </div>
        <button className="btn" type="submit">Continue</button>
      </form>
    </OnboardingFrame>
  );
}
