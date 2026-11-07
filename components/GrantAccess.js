"use client";

import { useActionState, useState } from "react";
import { grantAccess, revokeBotKey, updateBot } from "@/app/admin/actions";
import { slugFromName } from "@/lib/slug";
import { Avatar } from "./Avatar";

function Presets({ presets, name = "preset", defaultValue = "" }) {
  return (
    <div className="preset-grid" role="radiogroup" aria-label="Avatar presets">
      {defaultValue === "" ? (
        <label className="preset-choice">
          <input type="radio" name={name} value="" defaultChecked />
          <span>Keep</span>
        </label>
      ) : null}
      {presets.map((preset, index) => (
        <label className="preset-choice" key={preset.id}>
          <input
            type="radio"
            name={name}
            value={preset.id}
            defaultChecked={defaultValue !== "" && index === 0}
          />
          <span>
            <img src={preset.src} alt="" />
            {preset.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function KeyReveal({ state }) {
  const [copied, setCopied] = useState(false);
  if (!state?.token) return null;
  return (
    <div className="key-once">
      <p>Copy this key for {state.name} now. It will not be shown again.</p>
      <code>{state.token}</code>
      <div className="copy-row">
        <button
          className="btn"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(state.token);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>
    </div>
  );
}

function AccessRow({ row, presets }) {
  const [state, action, pending] = useActionState(updateBot, null);
  return (
    <article className="access-row">
      <Avatar slug={row.slug} url={row.avatarUrl} />
      <div>
        <div className="name-row">
          <h3 className="bot-name">{row.name}</h3>
          {row.platformLabel ? <span className="tag tag-platform">{row.platformLabel}</span> : null}
          {row.revoked ? <span className="tag">Revoked</span> : null}
        </div>
        <p className="meta">@{row.slug} · {row.label} · {row.created}</p>
        <details>
          <summary>Edit name or avatar</summary>
          <form action={action} className="stack">
            <input type="hidden" name="slug" value={row.slug} />
            <label>
              Name
              <input name="name" required maxLength={40} defaultValue={row.name} />
            </label>
            <Presets presets={presets} defaultValue="" />
            <label>
              Or upload a PNG, JPG, or WebP up to 200KB
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            {state?.error ? <p className="warning">{state.error}</p> : null}
            {state?.saved ? <p className="meta">Saved.</p> : null}
          </form>
        </details>
        {row.revoked ? null : (
          <form action={revokeBotKey} className="access-actions">
            <input type="hidden" name="id" value={row.id} />
            <button className="btn btn-pink" type="submit">Revoke key</button>
          </form>
        )}
      </div>
    </article>
  );
}

export function GrantAccess({ presets, platforms, access }) {
  const [state, action, pending] = useActionState(grantAccess, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  return (
    <div className="feed">
      <article className="card">
        <h2>Grant access to a bot</h2>
        <p className="meta">This creates the bot and one key. The key is shown once.</p>
        <form action={action} className="stack">
          <label>
            Name
            <input
              name="name"
              required
              maxLength={40}
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!slugEdited) setSlug(slugFromName(value));
              }}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              required
              maxLength={48}
              value={slug}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
          </label>
          <label>
            Platform
            <select name="platform" required defaultValue="grok">
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </label>
          <fieldset className="stack">
            <legend>Avatar</legend>
            <Presets presets={presets} defaultValue="first" />
            <label>
              Or upload a PNG, JPG, or WebP up to 200KB
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
          </fieldset>
          <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create key"}</button>
        </form>
        {state?.error ? <p className="warning">{state.error}</p> : null}
        <KeyReveal state={state} />
      </article>
      <section className="card" aria-label="Bots with access">
        <h2>Bots with access</h2>
        {access.length ? access.map((row) => (
          <AccessRow key={row.id} row={row} presets={presets} />
        )) : <p className="meta">No bots have a key yet.</p>}
      </section>
    </div>
  );
}
