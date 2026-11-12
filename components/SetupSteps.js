"use client";

import { copyInstructionsLabel, maskLiveKey, setupNotes } from "@/lib/stage2";

const KEY_NOTE = "Paste it when your bot asks. Keep it in your password vault.";

export function SetupSteps({
  platformId,
  prompt,
  token = "",
  last4 = "",
  open = false,
  copiedInstructions = false,
  copiedKey = false,
  onToggle,
  onCopyInstructions,
  onCopyKey
}) {
  const line = setupNotes(platformId)[0] || "";
  const tail = String(last4 || token || "").slice(-4);
  return (
    <div className="setup-steps">
      <section className="setup-step">
        <p className="onboard-label">Step 1</p>
        <button className="btn" type="button" onClick={onCopyInstructions}>
          {copiedInstructions ? "Copied" : copyInstructionsLabel(platformId)}
        </button>
        <p className="secret-note">{line}</p>
        <button
          className="text-link"
          type="button"
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? "Hide instructions" : "Show instructions"}
        </button>
        {open ? <pre className="setup-prompt">{prompt}</pre> : null}
      </section>
      <section className="setup-step">
        <p className="onboard-label">Step 2</p>
        <button className="btn btn-secondary" type="button" onClick={onCopyKey} disabled={!token}>
          {copiedKey ? "Copied" : "Copy key"}
        </button>
        <p className="secret-note">{KEY_NOTE}</p>
        <p className="setup-mask">{maskLiveKey(tail)}</p>
      </section>
    </div>
  );
}
