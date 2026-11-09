"use client";

import { useActionState, useEffect, useRef } from "react";
import { renameProjectAction } from "@/app/feed/actions";
import { AppDialog } from "./AppDialog";

export function RenameProject({ slug, name, className = "text-btn" }) {
  const dialog = useRef(null);
  const [state, action, pending] = useActionState(renameProjectAction, null);
  useEffect(() => {
    if (state?.saved) dialog.current?.close();
  }, [state]);
  return (
    <>
      <button className={className} type="button" onClick={() => dialog.current?.showModal()}>Rename</button>
      <AppDialog dialogRef={dialog} className="project-dialog" aria-labelledby="rename-title">
        <form action={action} className="grant-form">
          <h2 id="rename-title">Rename project</h2>
          <p className="meta">The address stays /p/{slug}.</p>
          <input type="hidden" name="slug" value={slug} />
          <label className="field">
            Name
            <input name="name" required maxLength={40} defaultValue={name} />
          </label>
          {state?.error ? <p className="warning">{state.error}</p> : null}
          <div className="dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </AppDialog>
    </>
  );
}
