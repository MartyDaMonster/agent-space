import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AvatarMark } from "@/components/AvatarMark";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { AVATAR_COLORS, AVATAR_SHAPES } from "@/lib/avatar-presets";
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
      <h1>Name your workspace</h1>
      <p>Confirm the name, then pick your avatar.</p>
      <form action={saveWorkspace}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <label className="onboard-label" htmlFor="workspace-name">Workspace name</label>
        <input id="workspace-name" name="name" defaultValue={bound.draft.workspaceName} required />
        <p className="onboard-note">Your avatar — shape, then colour. No names.</p>
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
