"use client";

import { useState } from "react";
import { finishAllowed, maskLiveKey, setupPrompt } from "@/lib/stage2";

export function BotSetup({ inviteId, workspaceName, repo, bots, prompts, secrets, regenerate, finish }) {
  const [open, setOpen] = useState("");
  const [rows, setRows] = useState(bots);
  const [shown, setShown] = useState(secrets || {});
  const allowed = finishAllowed(rows);
  const connected = rows.filter((bot) => bot.connected).length;
  async function copyPrompt(slug) {
    const text = prompts[slug] || "";
    if (text) await navigator.clipboard.writeText(text);
  }
  async function copySecret(slug) {
    const token = shown[slug];
    if (token) await navigator.clipboard.writeText(token);
  }
  async function renew(slug) {
    const next = await regenerate(slug);
    if (!next?.token) return;
    setShown((current) => ({ ...current, [slug]: next.token }));
    setRows((current) => current.map((bot) => (
      bot.slug === slug ? { ...bot, last4: next.last4, connected: false } : bot
    )));
  }
  return (
    <div>
      <p className="onboard-progress">Connected <b>{connected} of {rows.length}</b></p>
      <div className="progress-bar" aria-hidden="true">
        {rows.map((bot) => <i key={bot.slug} data-on={bot.connected ? "yes" : "no"} />)}
      </div>
      {rows.map((bot) => {
        const prompt = prompts[bot.slug] || "";
        const visible = shown[bot.slug];
        const field = visible || maskLiveKey(bot.last4);
        return (
          <article className="bot-setup" key={bot.slug}>
            <header>
              <h2>{bot.name}</h2>
              <span className={bot.connected ? "pill connected" : "pill waiting"}>
                {bot.connected ? "Connected" : "Waiting"}
              </span>
            </header>
            <div className="bot-setup-actions">
              <button className="btn btn-quiet" type="button" onClick={() => copyPrompt(bot.slug)}>Copy bot setup instructions</button>
              <button className="text-link" type="button" onClick={() => setOpen(open === bot.slug ? "" : bot.slug)}>
                {open === bot.slug ? "Hide setup instructions" : "Read setup instructions"}
              </button>
            </div>
            {open === bot.slug ? <pre className="setup-prompt">{prompt}</pre> : null}
            <p className="onboard-label">Secret code</p>
            <div className="secret-row">
              <input readOnly value={field} aria-label={`${bot.name} secret code`} />
              <button className="btn btn-quiet" type="button" onClick={() => copySecret(bot.slug)} disabled={!visible}>Copy</button>
            </div>
            <p className="secret-note">
              Your secret key is only shown once, so please copy and pass it to your bot now.
              {" "}
              <button type="button" className="text-link" onClick={() => renew(bot.slug)}>Regenerate</button>
            </p>
          </article>
        );
      })}
      <form action={finish}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <button className="btn" type="submit" disabled={!allowed}>Finish</button>
      </form>
    </div>
  );
}
