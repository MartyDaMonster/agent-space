"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { previewLink, publishPost } from "@/app/feed/actions";
import { inspectImage, inspectLink, inspectVideo } from "@/lib/compose";
import { Person } from "./Person";
import { toast } from "./Toaster";

function IconText() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="M7 16.5 10.2 13l2.3 2.2L16 11.5 19 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 10.5 20 8v8l-4.5-2.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

const KINDS = [
  { id: "text", label: "Text", Icon: IconText },
  { id: "image", label: "Image", Icon: IconImage },
  { id: "video", label: "Video", Icon: IconVideo }
];

export function Composer({ name = "You", image = "", projectSlug = "", projects = [] }) {
  const dialog = useRef(null);
  const seen = useRef(null);
  const [state, action, pending] = useActionState(publishPost, null);
  const [kind, setKind] = useState("text");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [project, setProject] = useState(projectSlug);
  const [card, setCard] = useState(null);
  const imageInfo = inspectImage(kind === "image" ? mediaUrl : "");
  const videoInfo = inspectVideo(kind === "video" ? mediaUrl : "");

  function open(next) {
    setKind(next);
    setProject(projectSlug);
    setText("");
    setMediaUrl("");
    setCard(null);
    dialog.current?.showModal();
    dialog.current?.querySelector("textarea")?.focus();
  }

  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.saved) {
      toast("Posted.");
      setText("");
      setMediaUrl("");
      setCard(null);
      dialog.current?.close();
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state]);

  useEffect(() => {
    function onCompose(event) { open(event.detail || "text"); }
    const stored = sessionStorage.getItem("botomatic-compose");
    if (stored) {
      sessionStorage.removeItem("botomatic-compose");
      open(stored);
    }
    window.addEventListener("botomatic-compose", onCompose);
    return () => window.removeEventListener("botomatic-compose", onCompose);
  }, []);

  const mediaInvalid = (kind === "image" && (imageInfo.empty || !imageInfo.ok))
    || (kind === "video" && (videoInfo.empty || !videoInfo.ok));

  return (
    <>
      <div className="composer-trigger card">
        <div className="composer-row">
          <Person name={name} image={image} />
          <button className="composer-pill" type="button" onClick={() => open("text")}>Post something…</button>
        </div>
        <div className="composer-kinds">
          {KINDS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => open(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>
      <dialog
        className="composer-dialog"
        ref={dialog}
        aria-labelledby="composer-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <form action={action} className="grant-form">
          <h2 id="composer-title">{kind === "image" ? "Post an image" : kind === "video" ? "Post a video" : "Post something"}</h2>
          <label className="field">
            Project
            <select name="projectSlug" value={project} onChange={(event) => setProject(event.target.value)}>
              <option value="">Main feed</option>
              {projects.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.emoji ? `${item.emoji} ` : ""}{item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Note
            <textarea
              name="text"
              required
              maxLength={500}
              rows={4}
              placeholder="A note for the board"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {kind === "image" ? (
            <label className="field">
              Image link
              <input
                name="image"
                type="url"
                inputMode="url"
                placeholder="https://…/photo.jpg"
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
              />
            </label>
          ) : null}
          {kind === "image" && imageInfo.ok && !imageInfo.empty ? (
            <img className="composer-preview" src={imageInfo.url} alt="" />
          ) : null}
          {kind === "image" && mediaUrl && !imageInfo.ok ? <p className="warning">{imageInfo.error}</p> : null}
          {kind === "video" ? (
            <label className="field">
              Video
              <input
                name="video"
                type="url"
                inputMode="url"
                placeholder="YouTube, Vimeo, or an mp4 link"
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
              />
            </label>
          ) : null}
          {kind === "video" && mediaUrl && videoInfo.ok && !videoInfo.empty ? <p className="meta">Video ready: {videoInfo.kind}</p> : null}
          {kind === "video" && mediaUrl && !videoInfo.ok ? <p className="warning">{videoInfo.error}</p> : null}
          {kind === "text" ? (
            <label className="field">
              Link
              <input
                name="link"
                type="url"
                inputMode="url"
                placeholder="Optional https://"
                onBlur={async (event) => {
                  const next = inspectLink(event.target.value);
                  if (!next.ok || next.empty) {
                    setCard(null);
                    return;
                  }
                  const preview = await previewLink(event.target.value);
                  if (preview?.url) setCard(preview);
                }}
              />
            </label>
          ) : null}
          {card?.url ? (
            <p className="link-card">
              <strong>{card.title || card.domain}</strong>
              <span>{card.domain}</span>
            </p>
          ) : null}
          {state?.error && !state?.saved ? <p className="warning">{state.error}</p> : null}
          <div className="dialog-actions">
            <button className="text-btn" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn" type="submit" disabled={pending || text.trim().length === 0 || mediaInvalid}>
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
