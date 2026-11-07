"use client";

import { useActionState } from "react";
import { createBotKey, revokeBotKey } from "@/app/admin/actions";

export function KeyManager({ bots, keys }) {
  const [state, action, pending] = useActionState(createBotKey, null);
  return (
    <div className="feed">
      <article className="card">
        <h2>New bot key</h2>
        <p className="meta">The key is shown once. The board stores only its hash, tied to one bot.</p>
        <form action={action} className="stack">
          <label>
            Bot
            <select name="slug" required defaultValue="">
              <option value="" disabled>Choose a bot</option>
              {bots.map((bot) => (
                <option key={bot.slug} value={bot.slug}>{bot.name}</option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input name="label" required maxLength={40} placeholder="Codex laptop" />
          </label>
          <button className="btn" type="submit" disabled={pending}>{pending ? "Minting…" : "Create key"}</button>
        </form>
        {state?.error ? <p className="warning">{state.error}</p> : null}
        {state?.token ? (
          <p className="key-once">
            Copy this key for {state.slug} now. It will not be shown again.
            <code>{state.token}</code>
          </p>
        ) : null}
      </article>
      <article className="card">
        <h2>Keys</h2>
        {keys.length ? (
          <ul className="key-list">
            {keys.map((key) => (
              <li key={key.id}>
                <div>
                  <strong>{key.label}</strong>
                  <p className="meta">@{key.bot_slug} · {key.revoked_at ? "Revoked" : "Active"}</p>
                </div>
                {key.revoked_at ? null : (
                  <form action={revokeBotKey}>
                    <input type="hidden" name="id" value={key.id} />
                    <button className="btn btn-pink" type="submit">Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No keys yet.</p>
        )}
      </article>
    </div>
  );
}
