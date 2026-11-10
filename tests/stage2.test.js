import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checklistReady,
  finishAllowed,
  githubAppConfigured,
  GITHUB_APP_ENV,
  maskLiveKey,
  migrateOnThisDeploy,
  promptContainsSecret,
  quietFeedCopy,
  repoNameForSlug,
  setupPrompt
} from "../lib/stage2.js";

test("an invite needs two assistants and a private repo name", () => {
  assert.equal(checklistReady({ assistants: ["claude"] }), false);
  assert.equal(checklistReady({ assistants: ["claude", "grok"] }), true);
  assert.equal(repoNameForSlug("example-workspace"), "botomatic-example-workspace");
  const prompt = setupPrompt({
    botName: "Claude",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "claude"
  });
  assert.match(prompt, /Use the key saved as BOTOMATIC_KEY/);
  assert.match(prompt, /Check the board at least every 15 minutes/);
  assert.match(prompt, /Needs an Anthropic account/);
  assert.equal(promptContainsSecret(prompt), false);
  assert.equal(prompt.includes("bmk_live_"), false);
  const grok = setupPrompt({
    botName: "Grok Bot",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "grok"
  });
  assert.match(grok, /POST \/api\/posts with \{"text":"\.\.\."\}/);
});

test("keys stay masked and finish waits for every bot", () => {
  assert.equal(maskLiveKey("a91f"), "bmk_live_••••••••••••a91f");
  assert.equal(finishAllowed([{ connected: true }, { connected: false }]), false);
  assert.equal(finishAllowed([{ connected: true }, { connected: true }]), true);
  assert.equal(quietFeedCopy("Example Workspace", ["Claude", "Grok Bot"]).body, "Your feed is quiet. Ask Claude or Grok Bot to take the first task.");
});

test("preview deploys do not apply schema changes", () => {
  assert.equal(migrateOnThisDeploy({ VERCEL_ENV: "preview" }, []), false);
  assert.equal(migrateOnThisDeploy({ VERCEL_ENV: "preview" }, ["node", "scripts/migrate.mjs", "--admin"]), true);
  assert.equal(migrateOnThisDeploy({ VERCEL_ENV: "production" }, ["node", "scripts/migrate.mjs", "--optional"]), true);
  assert.equal(githubAppConfigured({}), false);
  assert.equal(GITHUB_APP_ENV.includes("GITHUB_APP_PRIVATE_KEY"), true);
  const migrate = readFileSync(new URL("../scripts/migrate.mjs", import.meta.url), "utf8");
  assert.match(migrate, /migrateOnThisDeploy/);
  const bots = readFileSync(new URL("../components/BotSetup.js", import.meta.url), "utf8");
  assert.match(bots, /Copy bot setup instructions/);
  assert.match(bots, /Read setup instructions/);
  assert.match(bots, /Hide setup instructions/);
  assert.match(bots, /Your secret key is only shown once, so please copy and pass it to your bot now\./);
});
