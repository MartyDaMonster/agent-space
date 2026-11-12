import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { botStartInstructions, promptsForInvite } from "../lib/grant.js";
import {
  checkMinutes,
  claudeInvitePrompt,
  codexInvitePrompt,
  environmentName,
  keyNoteFor,
  keyVariable
} from "../lib/invite-setup.js";
import { setupPrompt } from "../lib/stage2.js";

const secret = "bmk_live_abcdefghijklmnopqrstuv";

function fields(extra = {}) {
  return {
    botName: "Bill",
    slug: "bill",
    ownerName: "Marty",
    otherBots: "Dexter (dexter)",
    slugs: ["bill", "dexter"],
    ...extra
  };
}

test("invite instructions fill every placeholder and never include the key", () => {
  const prompts = promptsForInvite(fields());
  for (const [platform, text] of Object.entries(prompts)) {
    assert.equal(text.includes("{{"), false, platform);
    assert.equal(text.includes(secret), false, platform);
    assert.equal(text.includes("bmk_live_"), false, platform);
  }
  assert.match(prompts.claude, /BOTOMATIC_KEY_BILL/);
  assert.match(prompts.claude, /Botomatic Bill/);
  assert.match(prompts.claude, /owned by Marty/);
  assert.match(prompts.claude, /Dexter \(dexter\)/);
  assert.match(prompts.claude, /Australian English/);
  assert.match(prompts.claude, /Australia\/Sydney/);
  assert.match(prompts.claude, /04, 19, 34, 49/);
  assert.match(prompts.codex, /Luna, low reasoning/);
  assert.match(prompts.codex, /Sol, medium reasoning/);
  assert.match(prompts.codex, /Account: bill/);
  assert.match(prompts.codex, /GET \/api\/posts\?cursor=/);
  assert.match(prompts.codex, /nextCursor/);
  assert.match(prompts.codex, /mentions=bill/);
  assert.match(prompts.grok, /secure secret request named BOTOMATIC_KEY/);
  assert.equal(keyVariable("grok-bot"), "BOTOMATIC_KEY_GROK_BOT");
  assert.equal(environmentName("Bill"), "Botomatic Bill");
  assert.equal(checkMinutes("bill", ["bill"]), "04, 19, 34, 49");
  assert.equal(checkMinutes("dexter", ["bill", "dexter"]), "11, 26, 41, 56");
  assert.equal(keyNoteFor("codex"), "Save it in Keychain (or your password vault) when Codex asks.");
  assert.match(keyNoteFor("claude", fields()), /BOTOMATIC_KEY_BILL/);
  assert.match(keyNoteFor("claude", fields()), /value box/);
  assert.equal(claudeInvitePrompt(fields()).includes("{{"), false);
  assert.equal(codexInvitePrompt(fields()).includes("{{"), false);
  const copied = botStartInstructions({ name: "Bill", slug: "bill", token: secret, platform: "claude" });
  assert.equal(copied.includes(secret), false);
});

test("setup steps stay collapsed until the person opens them", () => {
  const steps = readFileSync(new URL("../components/SetupSteps.js", import.meta.url), "utf8");
  assert.match(steps, /open = false/);
  assert.match(steps, /Show instructions/);
  assert.match(steps, /\{open \? <pre className="setup-prompt">/);
  assert.doesNotMatch(steps, /\{token\}/);
  const grant = readFileSync(new URL("../components/GrantAccess.js", import.meta.url), "utf8");
  assert.match(grant, /INVITE_PLATFORMS/);
  assert.match(grant, /aria-label="Platform"/);
  for (const assistantId of ["claude", "chatgpt", "codex", "grok"]) {
    const text = setupPrompt({
      botName: "Bill",
      slug: "bill",
      assistantId,
      ownerName: "Marty",
      otherBots: "Dexter (dexter)"
    });
    assert.equal(text.includes("{{"), false, assistantId);
    assert.equal(text.includes(secret), false, assistantId);
  }
});
