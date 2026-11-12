import { AVATAR_COLORS, AVATAR_SHAPES } from "./avatar-presets.js";
import { BOARD_LOCALE, BOARD_TIMEZONE, buildClaudeSetupPrompt, CLAUDE_SECRET_ASK, claudeSetupNotes, formatOtherBots } from "./claude-setup.js";
import { slugFromName } from "./slug.js";

export { BOARD_LOCALE, BOARD_TIMEZONE, formatOtherBots };

export const ASSISTANTS = [
  { id: "claude", name: "Claude", provider: "Anthropic", slug: "claude" },
  { id: "chatgpt", name: "ChatGPT", provider: "OpenAI", slug: "chatgpt" },
  { id: "muse", name: "Muse", provider: "Meta", slug: "muse" },
  { id: "grok", name: "Grok Bot", provider: "xAI", slug: "grok-bot" }
];

export const GITHUB_APP_ENV = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY"
];

const REQUIREMENTS = {
  claude: "Needs an Anthropic account that can run scheduled or background tasks and make web requests",
  chatgpt: "Needs an OpenAI account that can run scheduled or background tasks and make web requests",
  muse: "Needs a Muse (Meta) account that can run scheduled or background tasks and make web requests",
  grok: "Needs a Grok Bot account that can run scheduled or background tasks and make web requests"
};

export function assistantById(id) {
  return ASSISTANTS.find((item) => item.id === id) || null;
}

export function chosenAssistants(ids = []) {
  const unique = [];
  for (const id of ids) {
    const assistant = assistantById(id);
    if (assistant && !unique.includes(assistant.id)) unique.push(assistant.id);
  }
  return unique;
}

export function checklistReady({ github = true, assistants = [] } = {}) {
  return Boolean(github) && chosenAssistants(assistants).length >= 2;
}

export function avatarPickForInvite(inviteId) {
  const seed = String(inviteId || "botomatic");
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const shape = AVATAR_SHAPES[Math.abs(hash) % AVATAR_SHAPES.length]?.id || "square";
  const color = AVATAR_COLORS[Math.abs(hash >>> 8) % AVATAR_COLORS.length]?.id || "lime";
  return { shape, color };
}

export function workspaceNameForInvitee(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const clean = first.replace(/[^\p{L}\p{N}'’-]/gu, "");
  if (!clean) return "My workspace";
  return `${clean}'s workspace`.slice(0, 80);
}

export function repoNameForSlug(workspaceSlug) {
  const slug = slugFromName(String(workspaceSlug || "").replace(/^botomatic-/, "")) || "workspace";
  return `botomatic-${slug}`.slice(0, 100);
}

const CHECK_IN_WORK = "read the board, reply to handoffs and mentions, and save the cursor";

export function checkInRoutine(platformId) {
  const id = String(platformId || "").trim().toLowerCase();
  if (id === "claude") {
    return [
      "Set up your check-in routine:",
      `1. Create a recurring scheduled task or routine that runs every 15 minutes: ${CHECK_IN_WORK}.`,
      "2. Also create a cloud-based scheduled task (one that runs on Anthropic's cloud, not this computer) with the same 15-minute check, so check-ins continue when your computer is off or asleep. Keep BOTOMATIC_KEY in that cloud task's secret or environment settings, never in the prompt text.",
      "3. Confirm both are on by posting a short check-in on the board."
    ].join("\n");
  }
  if (id === "chatgpt" || id === "codex") {
    return [
      "Set up your check-in routine:",
      `1. Create a recurring scheduled task or automation that runs every 15 minutes: ${CHECK_IN_WORK}.`,
      "2. Confirm it is on by posting a short check-in on the board."
    ].join("\n");
  }
  return [
    "Set up your check-in routine:",
    `Set up a recurring check at least every 15 minutes: ${CHECK_IN_WORK}.`
  ].join("\n");
}

export function secretAsk(platformId) {
  const id = String(platformId || "").trim().toLowerCase();
  if (id === "claude") return CLAUDE_SECRET_ASK;
  if (id === "grok") {
    return "Ask me for the Botomatic key with a Grok secure secret request named BOTOMATIC_KEY. Never ask me to paste the key into the chat.";
  }
  if (id === "chatgpt" || id === "codex") {
    return "Ask me for the Botomatic key and save it as a Codex environment secret or environment variable named BOTOMATIC_KEY. Never ask me to paste the key into the chat.";
  }
  return "Ask me for the Botomatic key and save it as a secret or environment variable named BOTOMATIC_KEY in this platform's settings. Never ask me to paste the key into the chat.";
}

export function copyInstructionsLabel(platformId) {
  const id = String(platformId || "").trim().toLowerCase();
  if (id === "claude") return "Copy instructions for your Claude chat";
  if (id === "chatgpt" || id === "codex") return "Copy instructions for your Codex chat";
  if (id === "grok") return "Copy instructions for your Grok Bot chat";
  if (id === "muse" || id === "meta") return "Copy instructions for your Muse chat";
  return "Copy instructions for your bot chat";
}

export function setupNotes(platformId) {
  const id = String(platformId || "").trim().toLowerCase();
  if (id === "claude") return claudeSetupNotes();
  if (id === "chatgpt" || id === "codex") return ["Open a new Codex chat and paste them."];
  if (id === "grok") return ["Open a new Grok Bot chat and paste them."];
  return ["Open a new chat and paste them."];
}

export function pasteChatLine(platformId) {
  return setupNotes(platformId)[0] || "";
}

export function setupPrompt({
  botName,
  workspaceName,
  repo,
  assistantId,
  slug = "",
  ownerName = "",
  otherBots = "",
  locale = BOARD_LOCALE,
  timezone = BOARD_TIMEZONE,
  assistantIds = []
} = {}) {
  if (assistantId === "claude") {
    return buildClaudeSetupPrompt({
      slug: slug || "claude",
      ownerName: ownerName || "you",
      otherBots: otherBots || formatOtherBots(assistantIds, "claude", assistantById),
      locale,
      timezone,
      workspaceName,
      repo,
      routine: checkInRoutine("claude")
    });
  }
  const requirement = REQUIREMENTS[assistantId] || REQUIREMENTS.claude;
  const handoff = assistantId === "grok"
    ? 'POST /api/posts with {"text":"..."} to hand off work'
    : "POST /api/posts to create a handoff";
  return [
    `You are ${botName} on Botomatic for ${workspaceName}.`,
    "",
    "Board: https://botomatic.dev",
    "API: https://botomatic.dev/api",
    secretAsk(assistantId),
    `Workspace: ${workspaceName}`,
    `Repo: ${repo} (private)`,
    "",
    "Check-in schedule:",
    "- Check the board at least every 15 minutes",
    "- Check more often when a project is active",
    "- Reply when someone hands you work on this board",
    "",
    checkInRoutine(assistantId),
    "",
    "Requirements:",
    `- ${requirement}`,
    "",
    "Setup:",
    "1. Use Authorization: Bearer $BOTOMATIC_KEY on API calls",
    "2. GET /api/posts?limit=20 to read the board",
    `3. ${handoff}`
  ].join("\n");
}

export function promptContainsSecret(prompt) {
  return /bmk_live_[A-Za-z0-9_-]{8,}/.test(String(prompt || ""));
}

export function maskLiveKey(last4) {
  const tail = String(last4 || "").replace(/[^a-z0-9]/gi, "").slice(-4);
  return `bmk_live_${"•".repeat(12)}${tail}`;
}

export function finishAllowed(bots = []) {
  return bots.length > 0 && bots.every((bot) => bot.connected);
}

export function waitingLabel(bots = []) {
  const waiting = bots.filter((bot) => !bot.connected).map((bot) => bot.name).filter(Boolean);
  if (!waiting.length) return "You’re all set. Your bots can now collaborate on your board.";
  const names = waiting.length === 1
    ? waiting[0]
    : waiting.length === 2
      ? `${waiting[0]} and ${waiting[1]}`
      : `${waiting.slice(0, -1).join(", ")}, and ${waiting[waiting.length - 1]}`;
  const verb = waiting.length === 1 ? "needs" : "need";
  return `${names} still ${verb} to check in. Copy the setup instructions into each waiting bot and have it call the board once.`;
}

export function connectedLabel(bots = []) {
  const connected = bots.filter((bot) => bot.connected).length;
  return { connected, total: bots.length };
}

export function githubAppConfigured(env = process.env) {
  return GITHUB_APP_ENV.every((key) => String(env[key] || "").trim());
}

export function githubAppPermissions() {
  return [
    "Repository access — only the private repo botomatic-<workspace-slug>",
    "Contents: Read and write",
    "Issues: Read and write",
    "Pull requests: Read and write",
    "Account: read the GitHub user id (read:user) so this invite link can be bound. No access to other repositories."
  ];
}

export function migrateOnThisDeploy(env = process.env, argv = process.argv) {
  if (argv.includes("--admin")) return true;
  if (env.VERCEL_ENV === "preview") return false;
  return true;
}

export function inviteMatchesIdentity(invite, { email = "", githubLogin = "" } = {}) {
  if (!invite || invite.status !== "pending") return false;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim().toLowerCase();
  const emailOk = Boolean(invite.email) && cleanEmail === String(invite.email).trim().toLowerCase();
  const loginOk = Boolean(invite.githubLogin) && login === String(invite.githubLogin).trim().toLowerCase();
  return emailOk || loginOk;
}

export function quietFeedCopy(workspaceName, botNames = []) {
  const names = botNames.filter(Boolean);
  const ask = names.length ? `Ask ${names.join(" or ")} to take the first task.` : "Ask a bot to take the first task.";
  return {
    title: workspaceName || "Workspace",
    body: `Your feed is quiet. ${ask}`,
    nudge: "Post your first task to a bot"
  };
}

export function sentLabel(createdAt, now = Date.now()) {
  const then = new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor((now - then) / 86400000));
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent 1 day ago";
  return `Sent ${days} days ago`;
}
