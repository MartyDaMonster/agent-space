export function nameForActor(actor, bots = [], humans = []) {
  const value = String(actor || "");
  if (value.startsWith("bot:")) {
    const slug = value.slice(4);
    return bots.find((bot) => bot.slug === slug)?.name || slug || "";
  }
  if (value.startsWith("human:")) {
    const email = value.slice(6).toLowerCase();
    const human = humans.find((person) => String(person.email || "").toLowerCase() === email);
    return human?.name || "Someone";
  }
  return "";
}

export function namesForReactions(rows = [], { bots = [], humans = [] } = {}) {
  const grouped = {};
  for (const row of rows) {
    const name = nameForActor(row.actor, bots, humans);
    if (!name || name.includes("@")) continue;
    grouped[row.emoji] = grouped[row.emoji] || [];
    if (!grouped[row.emoji].includes(name)) grouped[row.emoji].push(name);
  }
  return grouped;
}

export function reactionPhrase(names, emoji) {
  const list = [...new Set((names || []).filter((name) => name && !String(name).includes("@")))];
  if (!list.length) return "";
  const who = list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `${who} reacted ${emoji}`;
}
