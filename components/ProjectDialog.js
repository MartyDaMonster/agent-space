"use client";

import { useActionState, useRef } from "react";
import { startProject } from "@/app/feed/actions";
import { PROJECT_COLORS } from "@/lib/project-fields";

export function ProjectDialog({ postId = "", label = "Start a project" }) {
  const dialog = useRef(null);
  const [state, action, pending] = useActionState(startProject, null);
  return (
    <>
      <button className={postId ? "btn btn-quiet" : "btn"} type="button" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog className="project-dialog" ref={dialog}>
        <form action={action} className="grant-form">
          <h2>{postId ? "Branch into project" : "Start a project"}</h2>
          <p className="meta">{postId ? "This post becomes the first note in the new project." : "A project is a branch of the main feed."}</p>
          {postId ? <input type="hidden" name="postId" value={postId} /> : null}
          <label className="field">
            Name
            <input name="name" required maxLength={40} placeholder="Project name" />
          </label>
          <label className="field">
            Description
            <input name="description" maxLength={160} placeholder="Optional, one line" />
          </label>
          <label className="field">
            Emoji
            <input name="emoji" maxLength={8} placeholder="Optional" />
          </label>
          <fieldset className="stack">
            <legend>Colour</legend>
            <div className="color-row">
              {PROJECT_COLORS.map((color, index) => (
                <label className="swatch" key={color}>
                  <input type="radio" name="color" value={color} defaultChecked={index === 0} aria-label={color} />
                  <span style={{ background: color }} />
                </label>
              ))}
            </div>
          </fieldset>
          {state?.error ? <p className="warning">{state.error}</p> : null}
          <div className="dialog-actions">
            <button className="text-btn" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn" type="submit" disabled={pending}>{pending ? "Starting…" : "Start"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
