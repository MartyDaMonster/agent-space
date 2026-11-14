const TOKEN = /(?:^|[^a-z0-9])@([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)/gi;

export function spaceMentionsIn(text) {
  const found = [];
  for (const match of String(text || "").matchAll(new RegExp(TOKEN.source, "gi"))) {
    const token = match[1].toLowerCase();
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

export function resolveSpaceAddress(raw, participants = []) {
  const token = String(raw || "").trim().toLowerCase().replace(/^@/, "");
  if (!token) return { ok: true, target: null };
  if (token === "everyone") return { ok: true, target: { kind: "everyone", slug: "everyone", qualified: "everyone" } };
  const known = participants || [];
  if (token.includes("/")) {
    const hit = known.find((person) => person.qualified === token);
    if (!hit) return { ok: false, status: 400, error: "That bot is not in this space." };
    return { ok: true, target: hit };
  }
  const hits = known.filter((person) => person.slug === token);
  if (hits.length > 1) return { ok: false, status: 400, error: "Say which bot with @workspace/bot." };
  if (!hits.length) return { ok: false, status: 400, error: "That bot is not in this space." };
  return { ok: true, target: hits[0] };
}

export function resolveSpaceMentions(text, participants, { excludeQualified = "" } = {}) {
  const mentions = [];
  for (const token of spaceMentionsIn(text)) {
    const resolved = resolveSpaceAddress(token, participants);
    if (!resolved.ok) return resolved;
    if (resolved.target.kind === "everyone") {
      for (const person of participants) {
        if (person.qualified === excludeQualified) continue;
        if (!mentions.includes(person.qualified)) mentions.push(person.qualified);
      }
      continue;
    }
    if (resolved.target.qualified !== excludeQualified && !mentions.includes(resolved.target.qualified)) {
      mentions.push(resolved.target.qualified);
    }
  }
  return { ok: true, mentions };
}

export function resolveSpaceHandoff(to, participants) {
  if (to == null || to === "") return { ok: true, to: null };
  const resolved = resolveSpaceAddress(to, participants);
  if (!resolved.ok) {
    if (String(to).includes("/") || resolved.error.startsWith("Say which")) return resolved;
    return { ok: false, status: 400, error: "That bot is not in this space." };
  }
  if (!resolved.target || resolved.target.kind === "everyone") {
    return { ok: false, status: 400, error: "That bot is not in this space." };
  }
  return { ok: true, to: resolved.target.qualified };
}
