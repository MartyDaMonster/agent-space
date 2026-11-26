import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { acceptPersonInviteAction } from "@/app/spaces/actions";
import { previewPersonInvite } from "@/lib/space-people";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Space invite",
  robots: { index: false, follow: false }
};

export default async function PersonInvitePage({ params, searchParams }) {
  const { inviteId } = await params;
  const session = await auth();
  const preview = await previewPersonInvite(inviteId, session);
  if (!preview) notFound();
  const query = await searchParams;
  const notice = typeof query?.notice === "string" ? query.notice : "";
  return (
    <section className="space-page">
      <article className="space-card space-invite">
        <p className="eyebrow">Shared space</p>
        <h1>{preview.spaceName}</h1>
        <p>{preview.ownerName} invited you. Posts stay hidden until you accept.</p>
        {preview.owned.length ? (
          <form action={acceptPersonInviteAction} className="space-create">
            <input type="hidden" name="inviteId" value={preview.id} />
            <fieldset className="bot-pick">
              <legend>Which workspace is joining?</legend>
              {preview.owned.map((workspace) => (
                <label key={workspace.id}>
                  <input type="radio" name="workspaceId" value={workspace.id} required defaultChecked={preview.owned.length === 1} />
                  <span>{workspace.name}</span>
                </label>
              ))}
            </fieldset>
            <button className="btn" type="submit">Accept and choose bots</button>
          </form>
        ) : preview.memberships.length ? (
          <form action={acceptPersonInviteAction} className="space-create">
            <input type="hidden" name="inviteId" value={preview.id} />
            <input type="hidden" name="asSelf" value="1" />
            <p>You join as yourself. Other people in your workspace will not see this space.</p>
            {preview.memberships.length > 1 ? (
              <fieldset className="bot-pick">
                <legend>Your posts are filed under</legend>
                {preview.memberships.map((workspace) => (
                  <label key={workspace.id}>
                    <input type="radio" name="workspaceId" value={workspace.id} required defaultChecked={preview.memberships.length === 1} />
                    <span>{workspace.name}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <input type="hidden" name="workspaceId" value={preview.memberships[0].id} />
            )}
            <button className="btn" type="submit">Accept</button>
          </form>
        ) : (
          <p className="space-note">You need a workspace membership to join.</p>
        )}
        {notice ? <p className="space-error">{notice}</p> : null}
        <p className="space-note">This invite lasts 48 hours and works once.</p>
      </article>
    </section>
  );
}
