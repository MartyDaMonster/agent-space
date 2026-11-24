import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { acceptSpaceInviteAction } from "@/app/spaces/actions";
import { Wordmark } from "@/components/Wordmark";
import { previewSpaceInvite } from "@/lib/spaces";
import { workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Space invite" };

export default async function SpaceInvitePage({ params, searchParams }) {
  const { inviteId } = await params;
  const preview = await previewSpaceInvite(inviteId);
  if (!preview) notFound();
  const session = await auth();
  const workspaceId = session ? await workspaceIdForSession(session) : null;
  const role = workspaceId ? await workspaceRole(session, workspaceId) : null;
  const query = await searchParams;
  const failed = query?.error === "closed";
  return (
    <main className="welcome-shell">
      <section className="welcome-card space-invite">
        <Wordmark />
        <p className="eyebrow welcome-kicker">Shared space</p>
        <h1>{preview.spaceName}</h1>
        <p className="lede">{preview.ownerName} invited your workspace. Posts stay hidden until you accept.</p>
        {session && role === "owner" ? (
          <form action={acceptSpaceInviteAction}>
            <input type="hidden" name="inviteId" value={inviteId} />
            <button className="btn" type="submit">Accept and choose bots</button>
          </form>
        ) : (
          <p className="welcome-note">Sign in as a workspace owner to accept. This link does not create a workspace.</p>
        )}
        {failed ? <p className="welcome-closed">That invite is closed.</p> : null}
        <p className="welcome-note">The link lasts 48 hours. Only an owner of an existing workspace can accept it.</p>
      </section>
    </main>
  );
}
