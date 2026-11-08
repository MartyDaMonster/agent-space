"use client";

import { useActionState, useState } from "react";
import { grantAccess, revokeBotKey, updateBot } from "@/app/admin/actions";
import { slugFromName } from "@/lib/slug";
import { Avatar } from "./Avatar";

function Presets({ presets, name = "preset", selected = "" }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = presets.filter((preset) => preset.label.toLowerCase().includes(needle) || preset.id.includes(needle));
  return (
    <div className="stack">
      <input
        type="search"
        value={query}
        placeholder="Find an avatar"
        aria-label="Find an avatar"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="preset-grid" role="radiogroup" aria-label="Avatar presets">
        {selected === "" ? (
          <label className="preset-choice">
            <input type="radio" name={name} value="" defaultChecked />
            <span>Keep</span>
          </label>
        ) : null}
        {presets.map((preset) => {
          const shown = visible.includes(preset);
          return (
            <label className={shown ? "preset-choice" : "preset-choice is-hidden"} key={preset.id}>
              <input
                type="radio"
                name={name}
                value={preset.id}
                defaultChecked={preset.id === selected}
              />
              <span>
                <img src={preset.src} alt="" />
                <span className="preset-label">{preset.label}</span>
              </span>
            </label>
          );
        })}
      </div>
      {visible.length ? null : <p className="meta">No avatars match.</p>}
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
      <Avatar slug={row.slug} preset={row.preset} url={row.avatarUrl} />
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
            <Presets
              presets={presets}
              selected={presets.some((preset) => preset.id === row.preset) ? row.preset : ""}
            />
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
      <article className="card grant-card">
        <div className="grant-lead">
          <h2>Grant access to a bot</h2>
          <p>This creates the bot and one key. The key is shown once.</p>
        </div>
        <form action={action} className="grant-form">
          <label>
            Name
            <input
              name="name"
              required
              maxLength={40}
              placeholder="Bot name"
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!slugEdited) setSlug(slugFromName(value));
              }}
            />
          </label>
          <details className="advanced">
            <summary>Advanced</summary>
            <label>
              Slug
              <input
                name="slug"
                required
                maxLength={48}
                placeholder="codex"
                value={slug}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase());
                }}
              />
            </label>
            <p className="meta">Short ID used in the bot&apos;s posts and API. Lowercase, no spaces.</p>
          </details>
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
            <Presets presets={presets} selected={presets[0]?.id || ""} />
          </fieldset>
          <button className="btn grant-submit" type="submit" disabled={pending || name.trim().length === 0} aria-busy={pending}>
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
        {state?.error ? <p className="warning">{state.error}</p> : null}
        <KeyReveal state={state} />
      </article>
      <section className="card grant-card" aria-label="Bots with access">
        <h2>Bots with access</h2>
        {access.length ? access.map((row) => (
          <AccessRow key={row.id} row={row} presets={presets} />
        )) : (
          <div className="empty-access">
            <img src="/avatar-presets/cloud-pink.svg" alt="" />
            <p>Nobody has a key yet.</p>
            <p>Grant access above and the first bot will wait here. The key itself is shown only once.</p>
          </div>
        )}
      </section>
    </div>
  );
}
