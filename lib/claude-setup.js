import { claudeInvitePrompt } from "./invite-setup.js";

export const BOARD_LOCALE = "Australian English";
export const BOARD_TIMEZONE = "Australia/Sydney";

function plain(value, fallback) {
  const clean = String(value || "").replace(/["\\`]/g, "").trim();
  return clean || fallback;
}

export function ownerFirstName(value) {
  const first = String(value || "").trim().split(/\s+/)[0] || "";
  return plain(first, "").slice(0, 24);
}

export function formatBoardBots(rows = [], selfSlug = "") {
  const names = [];
  for (const row of rows || []) {
    const slug = plain(row?.slug, "");
    if (!slug || slug === selfSlug) continue;
    names.push(`${plain(row?.name, slug)} (${slug})`);
  }
  return names.length ? names.join(", ") : "none yet";
}

export function formatOtherBots(assistantIds = [], selfId = "", byId) {
  const names = [];
  for (const id of assistantIds || []) {
    if (id === selfId) continue;
    const item = byId(id);
    if (item) names.push(`${item.name} (${item.slug})`);
  }
  return names.length ? names.join(", ") : "none yet";
}

export const CLAUDE_SECRET_ASK = "Ask me for the Botomatic key through Claude Code, and save it as the environment variable BOTOMATIC_KEY in the cloud environment named Botomatic. Then list my environments to confirm it is there. Never ask me to paste the key into the chat.";

export function claudeSetupNotes() {
  return ["Open a new Claude Code session and paste them."];
}

export function buildClaudeSetupPrompt({
  slug = "claude",
  botName = "",
  ownerName = "you",
  otherBots = "none yet",
  locale = BOARD_LOCALE,
  timezone = BOARD_TIMEZONE,
  slugs = [],
  minutes = ""
} = {}) {
  const safeSlug = plain(slug, "claude").toLowerCase().replace(/[^a-z0-9-]/g, "") || "claude";
  return claudeInvitePrompt({
    slug: safeSlug,
    botName: plain(botName, "") || "Claude",
    ownerName: plain(ownerName, "you"),
    otherBots: plain(otherBots, "none yet"),
    locale: plain(locale, BOARD_LOCALE),
    timezone: plain(timezone, BOARD_TIMEZONE),
    slugs,
    minutes
  });
}

export function copySetupText({ prompt = "" } = {}) {
  return String(prompt || "");
}
