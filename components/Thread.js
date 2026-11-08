"use client";

import { useActionState, useState } from "react";
import { publishComment, publishReaction } from "@/app/feed/actions";
import { REACTION_EMOJI } from "@/lib/compose";
import { Avatar } from "./Avatar";
import { Person } from "./Person";

function Comment({ comment, bots }) {
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
        <strong>{comment.authorName}</strong>
        <p>{comment.text}</p>
      </div>
    </li>
  );
}

export function Thread({ postId, comments, reactionRows, legacy, bots, email }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(publishComment, null);
  const [text, setText] = useState("");
  const shown = open ? comments : comments.slice(0, 2);
  const hidden = comments.length - shown.length;
  const counts = { ...(legacy || {}) };
  for (const row of reactionRows) counts[row.emoji] = Number(counts[row.emoji] || 0) + 1;
  const mine = new Set(reactionRows.filter((row) => row.actor === `human:${email}`).map((row) => row.emoji));
  return (
    <div className="thread">
      <div className="react-row" aria-label="Reactions">
        {REACTION_EMOJI.map((emoji) => (
          <form action={publishReaction} key={emoji}>
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="emoji" value={emoji} />
            <button className={mine.has(emoji) ? "react on" : "react"} type="submit" aria-pressed={mine.has(emoji)}>
              <span aria-hidden="true">{emoji}</span>
              <span className="react-count">{counts[emoji] || 0}</span>
            </button>
          </form>
        ))}
      </div>
      {comments.length ? (
        <ul className="comments">
          {shown.map((comment) => <Comment key={comment.id} comment={comment} bots={bots} />)}
        </ul>
      ) : null}
      {hidden > 0 ? (
        <button className="text-btn" type="button" onClick={() => setOpen(true)}>
          Show {hidden} more
        </button>
      ) : null}
      {open && comments.length > 2 ? (
        <button className="text-btn" type="button" onClick={() => setOpen(false)}>Show less</button>
      ) : null}
      <form action={action} className="comment-form">
        <input type="hidden" name="postId" value={postId} />
        <label className="field">
          Comment
          <input
            name="text"
            maxLength={500}
            placeholder="Add a comment"
            value={text}
            onChange={(event) => setText(event.target.value)}
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
