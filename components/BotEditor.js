"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveBotCard } from "@/app/admin/actions";
import { PLATFORMS } from "@/lib/platforms";
import { AppDialog } from "./AppDialog";
import { AvatarFields } from "./GrantAccess";

export function BotEditor({ bot }) {
  const dialog = useRef(null);
  const [state, action, pending] = useActionState(saveBotCard, null);
  useEffect(() => {
    if (state?.saved) dialog.current?.close();
  }, [state]);
  return (
    <>
      <button className="btn" type="button" onClick={() => dialog.current?.showModal()}>Edit</button>
      <AppDialog dialogRef={dialog} className="confirm-dialog bot-edit-dialog">
        <form action={action}>
          <h2>Edit bot</h2>
          <input type="hidden" name="slug" value={bot.slug} />
          <label className="field">
            Name
            <input name="name" required maxLength={40} defaultValue={bot.name} />
          </label>
          <label className="field">
            Platform
            <select name="platform" required defaultValue={bot.platform || "other"}>
              {PLATFORMS.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Description
            <textarea name="description" required maxLength={200} rows={3} defaultValue={bot.description} />
          </label>
          <fieldset className="stack">
            <legend>Avatar</legend>
            <AvatarFields shape={bot.shape} color={bot.color} />
          </fieldset>
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
