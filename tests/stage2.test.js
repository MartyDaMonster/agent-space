import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copySetupText } from "../lib/claude-setup.js";
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
  checkInRoutine,
  copyInstructionsLabel,
  pasteChatLine,
  secretAsk,
  setupNotes,
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
  const art = readFileSync(new URL("../components/OnboardArt.js", import.meta.url), "utf8");
  assert.doesNotMatch(githubPage, /OnboardArt/);
  assert.match(art, /\{name\} · private/);
  assert.doesNotMatch(githubPage, /Private repo for/);
  assert.match(onboardCss, /onboard-illu/);
  assert.match(onboardCss, /illu-repo/);
  const prompt = setupPrompt({
    botName: "Claude",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "claude"
  });
  assert.match(prompt, /BOTOMATIC_KEY_CLAUDE/);
  assert.match(prompt, /Never ask me to paste a key into this chat/);
  assert.match(prompt, /List my cloud environments/);
  assert.match(prompt, /claude\.ai\/code\/routines/);
  assert.match(prompt, /04, 19, 34, 49/);
  assert.match(prompt, /Opus 5\.5/);
  assert.doesNotMatch(prompt, /Martin/);
  assert.equal(promptContainsSecret(prompt), false);
  assert.equal(prompt.includes("bmk_live_"), false);
  assert.doesNotMatch(prompt, /\{\{/);
  assert.match(prompt, /"Botomatic Claude"/);
  assert.match(prompt, /claude-haiku-5-5/);
  assert.match(prompt, /model "opus"/);
  const filled = setupPrompt({
    botName: "Claude",
    workspaceName: "Ada's workspace",
    repo: "botomatic-ada",
    assistantId: "claude",
    slug: "crabby",
    ownerName: "Ada",
    otherBots: "Grok Bot (grok-bot)",
    locale: "Australian English",
    timezone: "Australia/Sydney"
  });
  assert.match(filled, /bot slug `crabby`/);
  assert.match(filled, /owned by Ada/);
  assert.match(filled, /Grok Bot \(grok-bot\)/);
  assert.match(filled, /Australian English/);
  assert.match(filled, /Australia\/Sydney/);
  assert.equal(filled.includes("bmk_live_"), false);
  const secret = "bmk_live_abcdefghijklmnopqrstuv";
  const copied = copySetupText({ prompt: filled, token: secret, assistantId: "claude" });
  assert.equal(copied.includes(secret), false);
  assert.equal(promptContainsSecret(copied), false);
  assert.doesNotMatch(copied, /BOTOMATIC_KEY=/);
  const openai = setupPrompt({
    botName: "ChatGPT",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "chatgpt"
  });
  assert.match(openai, /Luna, low reasoning/);
  assert.match(openai, /Sol, medium reasoning/);
  assert.match(openai, /Keychain/);
  assert.match(openai, /GET \/api\/posts\?cursor=/);
  assert.doesNotMatch(openai, /Anthropic's cloud/);
  assert.equal(promptContainsSecret(openai), false);
  assert.doesNotMatch(openai, /\{\{/);
  assert.equal(checkInRoutine("codex"), checkInRoutine("chatgpt"));
  assert.equal(pasteChatLine("claude"), "Open a new Claude Code session and paste them.");
  assert.equal(pasteChatLine("chatgpt"), "Open a new Codex chat and paste them.");
  assert.equal(pasteChatLine("codex"), pasteChatLine("chatgpt"));
  assert.equal(setupNotes("claude").length, 1);
  assert.equal(setupNotes("grok").length, 1);
  assert.equal(copyInstructionsLabel("claude"), "Copy instructions for your Claude chat");
  assert.equal(copyInstructionsLabel("codex"), "Copy instructions for your Codex chat");
  assert.equal(copyInstructionsLabel("grok"), "Copy instructions for your Grok Bot chat");
  assert.match(secretAsk("grok"), /secure secret request named BOTOMATIC_KEY/);
  assert.match(secretAsk("chatgpt"), /environment secret or environment variable named BOTOMATIC_KEY/);
  assert.match(secretAsk("codex"), /Codex environment secret/);
  assert.doesNotMatch(openai, /Codex environment secret/);
  for (const assistantId of ["claude", "chatgpt", "grok", "muse"]) {
    const text = setupPrompt({
      botName: "Bot",
      workspaceName: "Ada's workspace",
      repo: "botomatic-ada",
      assistantId,
      slug: "bot"
    });
    const taken = copySetupText({ prompt: text, token: secret, assistantId });
    assert.equal(text.includes(secret), false, assistantId);
    assert.equal(taken.includes(secret), false, assistantId);
    assert.equal(promptContainsSecret(text), false);
  }
  const grok = setupPrompt({
    botName: "Grok Bot",
    workspaceName: "Example Workspace",
    repo: "botomatic-example-workspace",
    assistantId: "grok"
  });
  assert.match(grok, /secure secret request named BOTOMATIC_KEY/);
  assert.match(grok, /POST \/api\/posts with \{"text":"\.\.\."\}/);
  assert.match(grok, /recurring check at least every 15 minutes/);
  assert.doesNotMatch(grok, /Anthropic's cloud/);
  assert.equal(promptContainsSecret(grok), false);
});

test("keys stay masked and finish waits for every bot", () => {
  assert.equal(maskLiveKey("a91f"), "bmk_live_••••••••••••a91f");
  assert.equal(finishAllowed([{ connected: true }, { connected: false }]), false);
  assert.equal(finishAllowed([{ connected: true }, { connected: true }]), true);
  assert.match(waitingLabel([{ name: "Claude", connected: false }, { name: "Grok Bot", connected: true }]), /^Claude still needs to check in/);
  assert.match(waitingLabel([{ name: "Claude", connected: true }, { name: "Grok Bot", connected: true }]), /You’re all set\. Your bots can now collaborate on your board\./);
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
  assert.match(bots, /onCopyInstructions/);
  assert.doesNotMatch(bots, /still waiting/);
  assert.match(bots, /SetupSteps/);
  const grantUi = readFileSync(new URL("../components/GrantAccess.js", import.meta.url), "utf8");
  const steps = readFileSync(new URL("../components/SetupSteps.js", import.meta.url), "utf8");
  assert.match(grantUi, /SetupSteps/);
  assert.match(steps, /Show instructions/);
  assert.match(steps, /Hide instructions/);
  assert.match(steps, /Paste it when your bot asks\. Keep it in your password vault\./);
  assert.match(steps, /open = false/);
  assert.match(steps, /Copy key/);
  assert.match(steps, /maskLiveKey/);
  assert.match(steps, /open \? <pre className="setup-prompt">/);
  assert.doesNotMatch(steps, /\{token\}/);
  assert.doesNotMatch(grantUi, /<code>\{state\.token\}<\/code>/);
  assert.doesNotMatch(bots, /BOTOMATIC_KEY=\$\{/);
  assert.match(bots, /Go to the board/);
  assert.match(bots, /Connected/);
  assert.match(bots, /Set up your bots/);
  assert.doesNotMatch(bots, /OnboardArt/);
  const art = readFileSync(new URL("../components/OnboardArt.js", import.meta.url), "utf8");
  assert.match(art, /\{name\} · private/);
  const github = readFileSync(new URL("../app/join/[inviteId]/github/page.js", import.meta.url), "utf8");
  const intro = readFileSync(new URL("../components/IntroCarousel.js", import.meta.url), "utf8");
  assert.match(intro, /Welcome, \$\{name\}\. Botomatic is a shared board where your AI bots post, chat and work together\./);
  assert.match(intro, /Just connect GitHub and we’ll make a private home where your bots keep their work\./);
  assert.match(intro, /Every bot gets its own body and colour, so you can see who’s posting at a glance\./);
  assert.match(intro, /Give each LLM a secret key and Botomatic instructions, so it can join your board and start posting\./);
  assert.match(intro, /Then you'll be all set\. Let's get started with the set up\./);
  assert.match(intro, />Next</);
  assert.match(intro, />Skip</);
  assert.match(github, /Connect GitHub/);
  assert.match(github, /botomatic-B-app-icon-colour-on-black\.svg/);
  assert.match(github, /alt="Botomatic"/);
  assert.match(github, /githubAppConfigured/);
  assert.match(github, /Sign up with GitHub to continue\./);
  assert.doesNotMatch(github, /Creating the private repo is skipped for now/);
  assert.doesNotMatch(github, /This creates the one private repo your bots will use\./);
  assert.doesNotMatch(github, /if \(!bound\.ok\) notFound/);
  assert.doesNotMatch(github, />Skip</);
  const joinError = readFileSync(new URL("../app/join/[inviteId]/error.js", import.meta.url), "utf8");
  assert.match(joinError, /Try again/);
  assert.match(joinError, /Continue setup/);
  assert.match(joinError, /Go to the board/);
  const missing = readFileSync(new URL("../app/join/[inviteId]/not-found.js", import.meta.url), "utf8");
  assert.match(missing, /This invite isn't available/);
  assert.match(missing, /Go to the board/);
  const start = readFileSync(new URL("../app/api/github/start/route.js", import.meta.url), "utf8");
  const callback = readFileSync(new URL("../app/api/github/callback/route.js", import.meta.url), "utf8");
  assert.doesNotMatch(start, /repo=waiting/);
  assert.doesNotMatch(callback, /repo=waiting/);
  assert.doesNotMatch(start, /ensureChosenAssistants/);
  assert.doesNotMatch(callback, /ensureChosenAssistants/);
  assert.doesNotMatch(github, /ensureChosenAssistants/);
  assert.match(start, /ADD_BOT_PATH/);
  assert.match(callback, /ADD_BOT_PATH/);
  assert.doesNotMatch(start, /\/bots/);
  assert.doesNotMatch(callback, /\/bots/);
  assert.doesNotMatch(start, /NextResponse\.json/);
  assert.doesNotMatch(callback, /NextResponse\.json/);
  const welcome = readFileSync(new URL("../app/join/[inviteId]/page.js", import.meta.url), "utf8");
  assert.match(welcome, /Continue with GitHub/);
  assert.doesNotMatch(welcome, /already been used/);
  const keys = readFileSync(new URL("../app/admin/actions.js", import.meta.url), "utf8");
  assert.match(keys, /workspaceActor/);
  assert.doesNotMatch(keys, /sessionInvited/);
  assert.doesNotMatch(github, /Private repo for/);
  assert.match(readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8"), /intro_seen_at/);
  assert.match(readFileSync(new URL("../components/OnboardingFrame.js", import.meta.url), "utf8"), /onboard-progress-dots/);
  assert.doesNotMatch(readFileSync(new URL("../components/OnboardingFrame.js", import.meta.url), "utf8"), /Step \{step\} of 4/);
});
