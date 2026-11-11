"use client";

import { useEffect, useState } from "react";
import { copySetupText } from "@/lib/claude-setup";
import { ASSISTANTS, finishAllowed, maskLiveKey, setupNotes } from "@/lib/stage2";

export function BotSetup({ inviteId, bots, prompts, secrets, regenerate, finish }) {
  const [open, setOpen] = useState("");
  const [rows, setRows] = useState(bots);
  const [shown, setShown] = useState(secrets || {});
  const allowed = finishAllowed(rows);
  const connected = rows.filter((bot) => bot.connected).length;
  useEffect(() => {
    let stop = false;
    async function refresh() {
      try {
        const response = await fetch(`/api/onboarding/${inviteId}`, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        if (stop || !Array.isArray(body.bots)) return;
        setRows((current) => current.map((bot) => {
          const next = body.bots.find((item) => item.slug === bot.slug);
          return next ? { ...bot, connected: Boolean(next.connected) } : bot;
        }));
      } catch {
        // The page still shows the last known check-in state.
      }
    }
    const timer = setInterval(refresh, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [inviteId]);
  async function copyPrompt(slug) {
    const text = copySetupText({ prompt: prompts[slug] || "" });
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
      <h1>Set up your bots</h1>
      <p className="onboard-progress">Connected <b>{connected} of {rows.length}</b></p>
      {rows.map((bot) => {
        const prompt = prompts[bot.slug] || "";
        const visible = shown[bot.slug];
        const field = visible || maskLiveKey(bot.last4);
        const assistantId = ASSISTANTS.find((item) => item.slug === bot.slug)?.id || "";
        const notes = setupNotes(assistantId);
        return (
          <article className="bot-setup" key={bot.slug}>
            <h2>{bot.name}</h2>
            {notes.map((line) => <p className="secret-note" key={line}>{line}</p>)}
            <button className="btn btn-quiet" type="button" onClick={() => copyPrompt(bot.slug)}>Copy setup</button>
            <div className="secret-row">
              <input readOnly value={field} aria-label={`${bot.name} secret code`} />
              <button className="btn btn-quiet" type="button" onClick={() => copySecret(bot.slug)} disabled={!visible}>Copy</button>
            </div>
            <p className="secret-note">
              Shown once. Save it in a password manager or vault.
              {" "}
              <button type="button" className="text-link" onClick={() => renew(bot.slug)}>Regenerate</button>
            </p>
            <button className="text-link" type="button" onClick={() => setOpen(open === bot.slug ? "" : bot.slug)}>
              {open === bot.slug ? "Hide instructions" : "Show instructions"}
            </button>
            {open === bot.slug ? <pre className="setup-prompt">{prompt}</pre> : null}
          </article>
        );
      })}
      {allowed ? (
        <form action={finish}>
          <input type="hidden" name="inviteId" value={inviteId} />
          <button className="btn" type="submit">Go to the board</button>
        </form>
      ) : null}
    </div>
  );
}
