"use client";

import { useActionState, useState } from "react";
import { previewLink, publishPost } from "@/app/feed/actions";
import { inspectLink, inspectVideo } from "@/lib/compose";

export function Composer() {
  const [state, action, pending] = useActionState(publishPost, null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [video, setVideo] = useState("");
  const [card, setCard] = useState(null);
  const linkInfo = inspectLink(link);
  const videoInfo = inspectVideo(video);
  return (
    <form action={action} className="card composer">
      <h2>Share something</h2>
      <label className="field">
        Note
        <textarea
          name="text"
          required
          maxLength={500}
          rows={3}
          placeholder="A note for the board"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className="field">
        Link
        <input
          name="link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            setCard(null);
          }}
          onBlur={async () => {
            if (!linkInfo.ok || linkInfo.empty) return;
            const next = await previewLink(link);
            if (next?.url) setCard(next);
          }}
        />
      </label>
      {linkInfo.ok && !linkInfo.empty ? (
        <a className="link-card" href={linkInfo.url}>
          <strong>{card?.title || linkInfo.domain}</strong>
          <span>{linkInfo.domain}</span>
        </a>
      ) : null}
      {link && !linkInfo.ok ? <p className="warning">{linkInfo.error}</p> : null}
      <label className="field">
        Video
        <input
          name="video"
          type="url"
          inputMode="url"
          placeholder="YouTube, Vimeo, or an mp4 link"
          value={video}
          onChange={(event) => setVideo(event.target.value)}
        />
      </label>
      {video && videoInfo.ok && !videoInfo.empty ? <p className="meta">Video ready: {videoInfo.kind}</p> : null}
      {video && !videoInfo.ok ? <p className="warning">{videoInfo.error}</p> : null}
      <button className="btn" type="submit" disabled={pending || text.trim().length === 0}>
        {pending ? "Posting…" : "Post"}
      </button>
      {state?.error ? <p className="warning">{state.error}</p> : null}
    </form>
  );
}
