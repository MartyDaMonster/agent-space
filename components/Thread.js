"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { publishComment, purgeComment, restoreComment, retireComment, saveComment } from "@/app/feed/actions";
import { REACTION_EMOJI } from "@/lib/compose";
import { canEditComment } from "@/lib/moderation";
import { AppDialog } from "./AppDialog";
import { Avatar } from "./Avatar";
import { MentionField, MentionText } from "./Mentions";
import { ReactionChip } from "./ReactionChip";
import { scheduleDelete } from "./delete-undo";
import { Person } from "./Person";

function Comment({ comment, bots, people, email, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [state, action, pending] = useActionState(saveComment, null);
  const canEdit = canEditComment({
    actorEmail: email,
    authorEmail: comment.authorEmail,
    authorKind: comment.authorKind
  });
  useEffect(() => {
    if (state?.saved) setEditing(false);
  }, [state]);
  const bot = comment.authorKind === "bot"
    ? bots.find((item) => item.slug === comment.authorSlug)
    : null;
  return (
    <li>
      {bot ? (
        <Avatar slug={bot.slug} preset={bot.avatar} url={bot.avatar_url} shape={bot.avatar_shape} color={bot.avatar_color} small />
      ) : (
        <Person name={comment.authorName} image={comment.authorImage} small />
      )}
      <div>
        <div className="comment-top">
          <strong>{comment.authorName}</strong>
          {canEdit ? (
            <button className="text-btn" type="button" onClick={() => { setDraft(comment.text); setEditing(true); }}>Edit</button>
          ) : null}
          {comment.canDelete ? (
            <button className="text-btn" type="button" onClick={() => onDelete(comment.id)}>Delete</button>
          ) : null}
        </div>
        {comment.editedAt ? <span className="edited-mark">edited</span> : null}
        {editing ? (
          <form action={action} className="comment-edit">
            <input type="hidden" name="commentId" value={comment.id} />
            <MentionField as="textarea" name="text" value={draft} onChange={setDraft} people={people} maxLength={500} rows={3} />
            {state?.error ? <p className="warning">{state.error}</p> : null}
            <div className="dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn" type="submit" disabled={pending || draft.trim().length === 0}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        ) : (
          <MentionText text={comment.text} people={people} />
        )}
      </div>
    </li>
  );
}

export function Thread({ postId, comments, reactionNames = {}, reactionCounts = {}, mine = [], legacy, bots, email, people = [] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(publishComment, null);
  const [text, setText] = useState("");
  const [gone, setGone] = useState([]);
  const [pendingId, setPendingId] = useState("");
  const confirmDialog = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  const visible = comments.filter((comment) => !gone.includes(comment.id));
  const shown = open ? visible : visible.slice(0, 2);
  const hidden = visible.length - shown.length;
  const counts = Object.keys(reactionCounts).length ? reactionCounts : { ...(legacy || {}) };
  const pressed = new Set(mine);
  function commitDelete() {
    const commentId = pendingId;
    confirmDialog.current?.close();
    setPendingId("");
    if (!commentId) return;
    scheduleDelete({
      label: "Comment deleted.",
      hide: () => { if (alive.current) setGone((ids) => ids.includes(commentId) ? ids : [...ids, commentId]); },
      show: () => { if (alive.current) setGone((ids) => ids.filter((id) => id !== commentId)); },
      retire: () => retireComment(commentId),
      restore: () => restoreComment(commentId),
      purge: () => purgeComment(commentId)
    });
  }
  return (
    <div className="thread">
      <div className="react-row" aria-label="Reactions">
        {REACTION_EMOJI.map((emoji) => (
          <ReactionChip
            key={emoji}
            postId={postId}
            emoji={emoji}
            count={counts[emoji] || 0}
            names={reactionNames[emoji] || []}
            pressed={pressed.has(emoji)}
          />
        ))}
      </div>
      {visible.length ? (
        <ul className="comments">
          {shown.map((comment) => (
            <Comment key={comment.id} comment={comment} bots={bots} people={people} email={email} onDelete={(id) => { setPendingId(id); confirmDialog.current?.showModal(); }} />
          ))}
        </ul>
      ) : null}
      {hidden > 0 ? (
        <button className="text-btn" type="button" onClick={() => setOpen(true)}>
          Show {hidden} more
        </button>
      ) : null}
      {open && visible.length > 2 ? (
        <button className="text-btn" type="button" onClick={() => setOpen(false)}>Show less</button>
      ) : null}
      <AppDialog dialogRef={confirmDialog} className="confirm-dialog">
        <h2>Delete this comment?</h2>
        <p>You can undo for a few seconds.</p>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={() => confirmDialog.current?.close()}>Cancel</button>
          <button className="btn btn-pink" type="button" onClick={commitDelete}>Delete</button>
        </div>
      </AppDialog>
      <form action={action} className="comment-form">
        <input type="hidden" name="postId" value={postId} />
        <label className="field">
          Comment
          <MentionField
            name="text"
            maxLength={500}
            placeholder="Add a comment"
            value={text}
            people={people}
            onChange={setText}
          />
        </label>
        <button className="btn" type="submit" disabled={pending || text.trim().length === 0}>
          {pending ? "Sending…" : "Comment"}
        </button>
        {state?.error ? <p className="warning">{state.error}</p> : null}
      </form>
    </div>
  );
}
