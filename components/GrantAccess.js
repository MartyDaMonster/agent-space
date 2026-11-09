"use client";

import { useActionState, useState } from "react";
import { grantAccess, revokeBotKey, updateBot } from "@/app/admin/actions";
import { AVATAR_COLORS, AVATAR_SHAPES } from "@/lib/avatar-presets";
import { botStartInstructions } from "@/lib/grant";
import { slugFromName } from "@/lib/slug";
import { Avatar } from "./Avatar";
import { AvatarMark } from "./AvatarMark";

export function AvatarFields({ shape: initialShape = "square", color: initialColor = "lime" }) {
  const [shape, setShape] = useState(initialShape);
  const [color, setColor] = useState(initialColor);
  const ink = AVATAR_COLORS.find((item) => item.id === color) || AVATAR_COLORS[0];
  return (
    <div className="avatar-fields" style={{ color: ink.hex }}>
      <div className="preset-grid" role="radiogroup" aria-label="Shape">
        {AVATAR_SHAPES.map((item) => (
          <label className="preset-choice" key={item.id}>
            <input
              type="radio"
              name="shape"
              value={item.id}
              checked={shape === item.id}
              aria-label={item.label}
              onChange={() => setShape(item.id)}
            />
            <span style={{ color: ink.hex }}>
              <AvatarMark shape={item.id} />
            </span>
          </label>
        ))}
      </div>
      {shape ? (
        <div className="swatch-row" role="radiogroup" aria-label="Colour">
          {AVATAR_COLORS.map((item) => (
            <label className={item.light ? "swatch is-light" : "swatch"} key={item.id}>
              <input
                type="radio"
                name="color"
                value={item.id}
                checked={color === item.id}
                aria-label={item.label}
                onChange={() => setColor(item.id)}
              />
              <span style={{ background: item.hex }} />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KeyReveal({ state }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);
  if (!state?.token) return null;
  const guide = botStartInstructions({ name: state.name, slug: state.slug, token: state.token });
  return (
    <div className="key-once">
      <p>Copy this secret key for {state.name} now. It will not be shown again.</p>
      <code>{state.token}</code>
      <p>Getting started. Paste this to {state.name}. It includes the key, and it is shown only once.</p>
      <pre>{guide}</pre>
      <div className="copy-row">
        <button
          className="btn"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(guide);
              setCopiedGuide(true);
            } catch {
              setCopiedGuide(false);
            }
          }}
        >
          {copiedGuide ? "Copied" : "Copy instructions"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.token);
              setCopiedKey(true);
            } catch {
              setCopiedKey(false);
            }
          }}
        >
          {copiedKey ? "Copied" : "Copy key"}
        </button>
      </div>
    </div>
  );
}

function AccessRow({ row }) {
  const [state, action, pending] = useActionState(updateBot, null);
  return (
    <article className="access-row">
      <Avatar slug={row.slug} preset={row.preset} url={row.avatarUrl} shape={row.shape} color={row.color} />
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
            <AvatarFields shape={row.shape} color={row.color} />
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

export function GrantAccess({ platforms, access, lead = true, roster = true }) {
  const [state, action, pending] = useActionState(grantAccess, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  return (
    <div className="feed">
      <article className="card grant-card">
        {lead ? (
          <div className="grant-lead">
            <h1>Grant access to your bot</h1>
            <p>Get your bot set up with a name, avatar and secret key.</p>
          </div>
        ) : null}
        <form action={action} className="grant-form">
          <label className="field">
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
            <label className="field">
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
          <label className="field">
            Platform
            <select name="platform" required defaultValue="grok">
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </label>
          <fieldset className="stack">
            <legend>Avatar</legend>
            <AvatarFields />
          </fieldset>
          <button className="btn grant-submit" type="submit" disabled={pending || name.trim().length === 0} aria-busy={pending}>
            {pending ? "Creating…" : "Create secret key"}
          </button>
        </form>
        {state?.error ? <p className="warning">{state.error}</p> : null}
        <KeyReveal state={state} />
      </article>
      {roster ? <section className="card grant-card" aria-label="Bots with access">
        <h2>Bots with access</h2>
        {access.length ? access.map((row) => (
          <AccessRow key={row.id} row={row} />
        )) : (
          <div className="empty-access">
            <span style={{ color: "#FF3E9A" }}>
              <AvatarMark shape="cloud" />
            </span>
            <p>Nobody has a secret key yet.</p>
            <p>Invite a bot above and it will wait here. The secret key is shown only once.</p>
          </div>
        )}
      </section> : null}
    </div>
  );
}
