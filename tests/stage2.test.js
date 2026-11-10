import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  avatarPickForInvite,
  checklistReady,
  finishAllowed,
  waitingLabel,
  githubAppConfigured,
  GITHUB_APP_ENV,
  maskLiveKey,
  migrateOnThisDeploy,
  promptContainsSecret,
  quietFeedCopy,
  repoNameForSlug,
  setupPrompt,
  workspaceNameForInvitee
} from "../lib/stage2.js";

test("an invite needs two assistants and a private repo name", () => {
  assert.equal(checklistReady({ assistants: ["claude"] }), false);
  assert.equal(checklistReady({ assistants: ["claude", "grok"] }), true);
  assert.equal(repoNameForSlug("example-workspace"), "botomatic-example-workspace");
  const avatar = avatarPickForInvite("inv-ada");
  assert.equal(avatarPickForInvite("inv-ada").shape, avatar.shape);
  assert.equal(avatarPickForInvite("inv-ada").color, avatar.color);
  assert.equal(workspaceNameForInvitee("Ada"), "Ada's workspace");
  assert.equal(workspaceNameForInvitee("Ada Lovelace"), "Ada's workspace");
  assert.equal(workspaceNameForInvitee("  "), "My workspace");
  assert.equal(repoNameForSlug("ada-s-workspace"), "botomatic-ada-s-workspace");
  const githubPage = readFileSync(new URL("../app/join/[inviteId]/github/page.js", import.meta.url), "utf8");
  const onboardCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(githubPage, /OnboardArt/);
  assert.doesNotMatch(githubPage, /Private repo for/);
  assert.match(onboardCss, /onboard-illu/);
  assert.match(onboardCss, /illu-repo/);
  const prompt = setupPrompt({
    botName: "Claude",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "claude"
  });
  assert.match(prompt, /Use the key saved as BOTOMATIC_KEY/);
  assert.match(prompt, /Check the board at least every 15 minutes/);
  assert.match(prompt, /Reply when someone hands you work on this board/);
  assert.doesNotMatch(prompt, /Martin/);
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
  assert.match(waitingLabel([{ name: "Claude", connected: false }, { name: "Grok Bot", connected: true }]), /^Claude still needs to check in/);
  assert.match(waitingLabel([{ name: "Claude", connected: true }, { name: "Grok Bot", connected: true }]), /You’re all set\. Let’s make great things together\./);
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
  assert.match(bots, /Copy setup/);
  assert.doesNotMatch(bots, /still waiting/);
  assert.match(bots, /Read setup instructions/);
  assert.match(bots, /Hide setup instructions/);
  assert.match(bots, /Your secret key is only shown once, so please copy and pass it to your bot now\./);
  assert.match(bots, /Go to the board/);
  assert.match(bots, /Connected/);
  assert.match(bots, /You’re all set\. Let’s make great things together\./);
  assert.match(bots, /Give your LLM a secret key and Botomatic instructions\./);
  const art = readFileSync(new URL("../components/OnboardArt.js", import.meta.url), "utf8");
  assert.match(art, /\{name\} · private/);
  const start = readFileSync(new URL("../app/join/[inviteId]/start/page.js", import.meta.url), "utf8");
  const github = readFileSync(new URL("../app/join/[inviteId]/github/page.js", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../app/join/[inviteId]/workspace/page.js", import.meta.url), "utf8");
  assert.match(start, /Welcome, \$\{firstName\}\. Let’s get your bots collaborating\./);
  const checklist = readFileSync(new URL("../components/JoinChecklist.js", import.meta.url), "utf8");
  assert.match(checklist, />Next</);
  assert.doesNotMatch(checklist, /Skip/);
  assert.match(github, /Connect GitHub and we’ll make a private home for your bots\./);
  assert.match(github, /Connect GitHub/);
  assert.doesNotMatch(github, /Private repo for/);
  assert.doesNotMatch(github, />Skip</);
  assert.match(workspace, /Give your bot a name, body and colour\./);
  assert.match(workspace, /Let’s get you set up/);
  assert.match(workspace, /displayName/);
  assert.doesNotMatch(workspace, /shape-grid|color-row|maxLength/);
  assert.match(readFileSync(new URL("../components/OnboardingFrame.js", import.meta.url), "utf8"), /onboard-progress-dots/);
  assert.doesNotMatch(readFileSync(new URL("../components/OnboardingFrame.js", import.meta.url), "utf8"), /Step \{step\} of 4/);
});
