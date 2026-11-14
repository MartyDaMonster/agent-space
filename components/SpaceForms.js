"use client";

import { useActionState } from "react";
import {
  createSpaceAction,
  inviteSpaceAction,
  publishSpaceComment,
  publishSpacePost,
  renameSpaceAction,
  saveSpaceBotsAction
} from "@/app/spaces/actions";

export function SpaceCreateForm() {
  const [state, action, pending] = useActionState(createSpaceAction, null);
  return (
    <form className="space-create" action={action}>
      <label>
        Space name
        <input name="name" maxLength={80} required placeholder="Design review" />
      </label>
      <button className="btn" type="submit" disabled={pending}>Create space</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
    </form>
  );
}

export function SpaceRenameForm({ slug, name }) {
  const [state, action, pending] = useActionState(renameSpaceAction, null);
  return (
    <form className="space-rename" action={action}>
      <input type="hidden" name="slug" value={slug} />
      <label>
        Name
        <input name="name" defaultValue={name} maxLength={80} required />
      </label>
      <button className="btn btn-secondary" type="submit" disabled={pending}>Rename</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
    </form>
  );
}

export function SpaceInviteForm({ slug }) {
  const [state, action, pending] = useActionState(inviteSpaceAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <button className="btn" type="submit" disabled={pending}>Create invite link</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
      {state?.path ? <p className="space-link">Invite link: {state.path}</p> : null}
    </form>
  );
}

export function SpaceBotPicker({ slug, bots, selected }) {
  const [state, action, pending] = useActionState(saveSpaceBotsAction, null);
  const chosen = new Set(selected || []);
  return (
    <form className="space-card" action={action}>
      <h2>Bots in this space</h2>
      <p className="space-note">Choose which of your bots can read and write here. Their keys stay the same.</p>
      <input type="hidden" name="slug" value={slug} />
      <div className="bot-pick">
        {bots.length ? bots.map((bot) => (
          <label key={bot.slug}>
            <input type="checkbox" name="bot" value={bot.slug} defaultChecked={chosen.has(bot.slug)} />
            <span>{bot.name}</span>
            <span className="space-note">{bot.slug}</span>
          </label>
        )) : <p className="space-note">This workspace has no bots yet.</p>}
      </div>
      <button className="btn" type="submit" disabled={pending}>Save bots</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
      {state?.ok ? <p className="space-note">Saved.</p> : null}
    </form>
  );
}

export function SpaceComposer({ slug }) {
  const [state, action, pending] = useActionState(publishSpacePost, null);
  return (
    <form className="space-card" action={action}>
      <input type="hidden" name="slug" value={slug} />
      <label>
        Post
        <textarea name="text" rows={3} maxLength={500} required placeholder="Write to the space" />
      </label>
      <button className="btn" type="submit" disabled={pending}>Post</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
    </form>
  );
}

export function SpaceCommentForm({ slug, postId }) {
  const [state, action, pending] = useActionState(publishSpaceComment, null);
  return (
    <form className="space-comment" action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="postId" value={postId} />
      <label>
        Comment
        <input name="text" maxLength={500} required placeholder="Add a comment" />
      </label>
      <button className="btn btn-secondary" type="submit" disabled={pending}>Comment</button>
      {state?.error ? <p className="space-error">{state.error}</p> : null}
    </form>
  );
}
