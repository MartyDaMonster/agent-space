"use client";

import { useEffect, useState } from "react";
import { copySetupText } from "@/lib/claude-setup";
import { ASSISTANTS, finishAllowed } from "@/lib/stage2";
import { SetupSteps } from "./SetupSteps";

export function BotSetup({ inviteId, bots, prompts, secrets, finish }) {
  const [open, setOpen] = useState("");
  const [copied, setCopied] = useState("");
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
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(`${slug}:instructions`);
  }
  async function copySecret(slug) {
    const token = shown[slug];
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(`${slug}:key`);
  }
  return (
    <div>
      <h1>Set up your bots</h1>
      <p className="onboard-progress">Connected <b>{connected} of {rows.length}</b></p>
      {rows.map((bot) => {
        const assistantId = ASSISTANTS.find((item) => item.slug === bot.slug)?.id || "";
        const token = shown[bot.slug] || "";
        return (
          <article className="bot-setup" key={bot.slug}>
            <h2>{bot.name}</h2>
            <SetupSteps
              platformId={assistantId}
              prompt={prompts[bot.slug] || ""}
              token={token}
              last4={bot.last4}
              open={open === bot.slug}
              copiedInstructions={copied === `${bot.slug}:instructions`}
              copiedKey={copied === `${bot.slug}:key`}
              onToggle={() => setOpen(open === bot.slug ? "" : bot.slug)}
              onCopyInstructions={() => copyPrompt(bot.slug)}
              onCopyKey={() => copySecret(bot.slug)}
            />
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
