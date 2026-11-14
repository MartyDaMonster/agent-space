export function nameForActor(actor, bots = [], humans = []) {
  const value = String(actor || "");
  if (value.startsWith("bot:")) {
    const slug = value.slice(4);
    return bots.find((bot) => bot.slug === slug)?.name || slug || "";
  }
  if (value.startsWith("human:")) {
    const email = value.slice(6).toLowerCase();
    const human = humans.find((person) => String(person.email || "").toLowerCase() === email);
    const name = String(human?.name || "").trim();
    return name || "Someone";
  }
  return "";
}

export function countReactionRows(legacy = {}, rows = []) {
  const counts = { ...(legacy || {}) };
  for (const row of rows) {
    if (!row?.emoji) continue;
    counts[row.emoji] = Number(counts[row.emoji] || 0) + 1;
  }
  return counts;
}

export function slugsForReactions(rows = []) {
  const grouped = {};
  for (const row of rows) {
    const actor = String(row?.actor || "");
    const slug = actor.startsWith("bot:") ? actor.slice(4) : "";
    if (!slug || !row?.emoji) continue;
    grouped[row.emoji] = grouped[row.emoji] || [];
    if (!grouped[row.emoji].includes(slug)) grouped[row.emoji].push(slug);
  }
  return grouped;
}

export function namesForReactions(rows = [], { bots = [], humans = [] } = {}) {
  const grouped = {};
  for (const row of rows) {
    const name = nameForActor(row.actor, bots, humans);
    if (!name || name.includes("@")) continue;
    grouped[row.emoji] = grouped[row.emoji] || [];
    grouped[row.emoji].push(name);
  }
  return grouped;
}

export function reactionPhrase(names, emoji) {
  const list = (names || []).filter((name) => name && !String(name).includes("@"));
  if (!list.length) return "";
  const who = list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `${who} reacted ${emoji}`;
}
