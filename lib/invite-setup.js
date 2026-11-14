import { CLAUDE_INVITE_PROMPT, CODEX_INVITE_PROMPT } from "./invite-copy.js";

const BOARD_LOCALE = "Australian English";
const BOARD_TIMEZONE = "Australia/Sydney";

const MINUTE_SETS = [
  [4, 19, 34, 49],
  [11, 26, 41, 56],
  [2, 17, 32, 47],
  [8, 23, 38, 53]
];

const PLACEHOLDERS = [
  "BOT_NAME",
  "BOT_SLUG",
  "KEY_VAR",
  "ENV_NAME",
  "OWNER_NAME",
  "OTHER_BOTS",
  "LOCALE",
  "TIMEZONE",
  "MINUTES"
];

export const CODEX_KEY_NOTE = "Save it in Keychain (or your password vault) when Codex asks.";
export const GROK_KEY_NOTE = "Paste it when your bot asks. Keep it in your password vault.";

export const INVITE_PLATFORMS = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "grok", label: "Grok Bot" }
];

export function keyVariable(slug) {
  const clean = String(slug || "").trim().toUpperCase().replace(/-/g, "_").replace(/[^A-Z0-9_]/g, "");
  return `BOTOMATIC_KEY_${clean || "BOT"}`;
}

export function environmentName(botName) {
  const name = String(botName || "").trim() || "Bot";
  return `Botomatic ${name}`.slice(0, 80);
}

export function checkMinutes(slug, slugs = []) {
  const mine = String(slug || "").trim();
  const ordered = [...new Set([mine, ...(slugs || [])].map((item) => String(item || "").trim()).filter(Boolean))].sort();
  const index = Math.max(0, ordered.indexOf(mine));
  const set = MINUTE_SETS[index % MINUTE_SETS.length];
  return set.map((minute) => String(minute).padStart(2, "0")).join(", ");
}

export function fillInvitePrompt(template, fields = {}) {
  const slug = String(fields.slug || "").trim().toLowerCase();
  const values = {
    BOT_NAME: String(fields.botName || slug || "Bot").trim() || "Bot",
    BOT_SLUG: slug || "bot",
    KEY_VAR: keyVariable(slug),
    ENV_NAME: environmentName(fields.botName || slug),
    OWNER_NAME: String(fields.ownerName || "you").trim() || "you",
    OTHER_BOTS: String(fields.otherBots || "none yet").trim() || "none yet",
    LOCALE: String(fields.locale || BOARD_LOCALE).trim() || BOARD_LOCALE,
    TIMEZONE: String(fields.timezone || BOARD_TIMEZONE).trim() || BOARD_TIMEZONE,
    MINUTES: fields.minutes || checkMinutes(slug, fields.slugs || [slug])
  };
  let text = String(template || "");
  for (const key of PLACEHOLDERS) text = text.replaceAll(`{{${key}}}`, values[key]);
  if (text.includes("{{")) throw new Error("Invite instructions still have a placeholder.");
  return text;
}

export function claudeInvitePrompt(fields = {}) {
  return fillInvitePrompt(CLAUDE_INVITE_PROMPT, fields);
}

export function codexInvitePrompt(fields = {}) {
  return fillInvitePrompt(CODEX_INVITE_PROMPT, fields);
}

export function claudeKeyNote(fields = {}) {
  const name = String(fields.botName || "this bot").trim() || "this bot";
  const env = environmentName(name);
  const variable = keyVariable(fields.slug);
  return [
    "This key is shown once. Don't paste it into a chat.",
    `Open claude.ai/code and add an environment named ${env}. Allow botomatic.dev.`,
    `Type ${variable} in the name box. Paste the key in the value box, with nothing else around it.`
  ].join(" ");
}

export function keyNoteFor(platformId, fields = {}) {
  const id = String(platformId || "").trim().toLowerCase();
  if (id === "claude") return claudeKeyNote(fields);
  if (id === "codex" || id === "chatgpt") return CODEX_KEY_NOTE;
  return GROK_KEY_NOTE;
}
