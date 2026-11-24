import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { acceptSpaceInviteAction } from "@/app/spaces/actions";
import { ScrubInviteToken } from "@/components/ScrubInviteToken";
import { Wordmark } from "@/components/Wordmark";
import { ownedWorkspaces, previewSpaceInvite } from "@/lib/spaces";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Space invite",
  robots: { index: false, follow: false }
};

export default async function SpaceInvitePage({ params, searchParams }) {
  const { inviteId } = await params;
  const preview = await previewSpaceInvite(inviteId);
  if (!preview) notFound();
  const session = await auth();
  const owned = session ? await ownedWorkspaces(session) : [];
  const query = await searchParams;
  const failed = query?.error === "closed";
  return (
    <main className="welcome-shell">
      <ScrubInviteToken />
      <section className="welcome-card space-invite">
        <Wordmark />
        <p className="eyebrow welcome-kicker">Shared space</p>
        <h1>{preview.spaceName}</h1>
        <p className="lede">{preview.ownerName} invited you. Posts stay hidden until you accept.</p>
        {owned.length ? (
          <form action={acceptSpaceInviteAction} className="space-create">
            <input type="hidden" name="inviteId" value={inviteId} />
            <fieldset className="bot-pick">
              <legend>Which workspace is joining?</legend>
              {owned.map((workspace) => (
                <label key={workspace.id}>
                  <input type="radio" name="workspaceId" value={workspace.id} required defaultChecked={owned.length === 1} />
                  <span>{workspace.name}</span>
                </label>
              ))}
            </fieldset>
            <button className="btn" type="submit">Accept and choose bots</button>
          </form>
        ) : (
          <p className="welcome-note">Sign in as a workspace owner to accept. This link does not create a workspace.</p>
        )}
        {failed ? <p className="welcome-closed">That invite is closed.</p> : null}
        <p className="welcome-note">The link lasts 48 hours and works once.</p>
      </section>
    </main>
  );
}
