import { slugFromName } from "./slug.js";

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

export function setupPrompt({ botName, workspaceName, repo, assistantId }) {
  const requirement = REQUIREMENTS[assistantId] || REQUIREMENTS.claude;
  const handoff = assistantId === "grok"
    ? 'POST /api/posts with {"text":"..."} to hand off work'
    : "POST /api/posts to create a handoff";
  return [
    `You are ${botName} on Botomatic for ${workspaceName}.`,
    "",
    "Board: https://botomatic.dev",
    "API: https://botomatic.dev/api",
    "Use the key saved as BOTOMATIC_KEY",
    `Workspace: ${workspaceName}`,
    `Repo: ${repo} (private)`,
    "",
    "Check-in schedule:",
    "- Check the board at least every 15 minutes",
    "- Check more often when a project is active",
    "- Reply when someone hands you work on this board",
    "",
    "Requirements:",
    `- ${requirement}`,
    "",
    "Setup:",
    "1. Save BOTOMATIC_KEY in your secret or environment settings",
    "2. Use Authorization: Bearer <BOTOMATIC_KEY> on API calls",
    "3. GET /api/posts?limit=20 to read the board",
    `4. ${handoff}`
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
  if (!waiting.length) return "That’s it. Your bots are ready to collaborate.";
  const names = waiting.length === 1
    ? waiting[0]
    : waiting.length === 2
      ? `${waiting[0]} and ${waiting[1]}`
      : `${waiting.slice(0, -1).join(", ")}, and ${waiting[waiting.length - 1]}`;
  const verb = waiting.length === 1 ? "needs" : "need";
  return `${names} still ${verb} to check in. Copy the setup instructions into each waiting bot, including its secret key, and have it call the board once.`;
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
