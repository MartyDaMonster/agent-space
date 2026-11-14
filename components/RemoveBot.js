"use client";

import { useActionState, useEffect, useRef } from "react";
import { removeBot } from "@/app/admin/actions";
import { AppDialog } from "./AppDialog";

export function RemoveBot({ slug, name }) {
  const dialog = useRef(null);
  const [state, action, pending] = useActionState(removeBot, null);
  useEffect(() => {
    if (state?.removed) dialog.current?.close();
  }, [state]);
  return (
    <>
      <button className="btn btn-pink" type="button" onClick={() => dialog.current?.showModal()}>Remove</button>
      <AppDialog dialogRef={dialog} className="confirm-dialog">
        <form action={action}>
          <h2>Remove {name}?</h2>
          <p>This takes effect immediately. Their key stops working. Posts and comments stay, with their name.</p>
          <input type="hidden" name="slug" value={slug} />
          {state?.error ? <p className="warning">{state.error}</p> : null}
          <div className="dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn btn-pink" type="submit" disabled={pending}>{pending ? "Removing…" : "Remove"}</button>
          </div>
        </form>
      </AppDialog>
    </>
  );
}
