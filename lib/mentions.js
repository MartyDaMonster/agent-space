import { slugFromName } from "./slug.js";

const MENTION = /(^|[^a-z0-9])@([a-z0-9]+(?:-[a-z0-9]+)*)/gi;

export function commentAuthorFromBot(bot) {
  const slug = String(bot?.slug || "").trim();
  if (!slug) return { ok: false, error: "That bot could not be found." };
  const name = String(bot?.name || "").trim() || slug;
  return { ok: true, slug, name };
}

export function mentionDirectory(bots = [], humans = []) {
  const people = [{ slug: "everyone", name: "Everyone", kind: "everyone" }];
  const taken = new Set(["everyone"]);
  for (const bot of bots) {
    const slug = String(bot.slug || "").trim().toLowerCase();
    if (!slug || taken.has(slug)) continue;
    taken.add(slug);
    people.push({ slug, name: bot.name || slug, kind: "bot" });
  }
  for (const human of humans) {
    const name = String(human.name || "").trim();
    const email = String(human.email || "").trim().toLowerCase();
    let slug = slugFromName(name);
    if (!slug || taken.has(slug)) slug = slugFromName(email.split("@")[0]);
    if (!slug || taken.has(slug)) continue;
    taken.add(slug);
    people.push({ slug, name: name || email, kind: "human", email });
  }
  return people;
}

export function mentionSlugsIn(text, slugs) {
  const known = slugs instanceof Set ? slugs : new Set(slugs || []);
  const found = [];
  const pattern = new RegExp(MENTION.source, "gi");
  for (const match of String(text || "").matchAll(pattern)) {
    const slug = match[2].toLowerCase();
    if (known.has(slug) && !found.includes(slug)) found.push(slug);
  }
  return found;
}

export function mentionNotice(text, people) {
  return mentionSlugsIn(text, (people || []).map((person) => person.slug || person));
}

export function notifySlugs(text, people, { exclude = [] } = {}) {
  const found = mentionNotice(text, people);
  const explicit = found.filter((slug) => slug !== "everyone");
  if (!found.includes("everyone")) return explicit;
  const skip = new Set(exclude.map((slug) => String(slug || "").trim().toLowerCase()).filter(Boolean));
  const expanded = (people || [])
    .filter((person) => person.slug !== "everyone" && !skip.has(person.slug))
    .map((person) => person.slug);
  return [...new Set([...expanded, ...explicit])];
}

export function mentionSlugFor({ email = "", botSlug = "" } = {}, people = []) {
  const bot = String(botSlug || "").trim().toLowerCase();
  if (bot) return bot;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "";
  return people.find((person) => person.email === normalized)?.slug || "";
}

export function exposeMentions(posts, { postsById = {}, commentsById = {} } = {}) {
  return (posts || []).map((post) => ({
    ...post,
    mentions: postsById[post.id] || [],
    comments: (post.comments || []).map((comment) => ({
      ...comment,
      mentions: commentsById[comment.id] || []
    }))
  }));
}

export function mentionAtCaret(text, caret) {
  const upto = String(text || "").slice(0, caret ?? String(text || "").length);
  const match = /(^|[^a-zA-Z0-9])@([a-zA-Z0-9-]*)$/.exec(upto);
  if (!match) return null;
  return {
    start: upto.length - match[2].length - 1,
    end: caret ?? upto.length,
    query: match[2]
  };
}

export function filterMentions(people, query) {
  const q = String(query || "").toLowerCase();
  return (people || []).filter((person) =>
    person.slug.includes(q) || String(person.name || "").toLowerCase().includes(q)
  ).sort((a, b) => Number(b.slug === "everyone") - Number(a.slug === "everyone")).slice(0, 8);
}

export function splitMentions(text, people) {
  const known = new Map((people || []).map((person) => [person.slug, person]));
  const source = String(text || "");
  const parts = [];
  let last = 0;
  const pattern = new RegExp(MENTION.source, "gi");
  for (const match of source.matchAll(pattern)) {
    const slug = match[2].toLowerCase();
    const person = known.get(slug);
    const at = match.index + match[1].length;
    if (!person) continue;
    if (at > last) parts.push({ type: "text", text: source.slice(last, at) });
    parts.push({ type: "mention", slug, name: person.name, kind: person.kind });
    last = at + slug.length + 1;
  }
  if (last < source.length) parts.push({ type: "text", text: source.slice(last) });
  return parts.length ? parts : [{ type: "text", text: source }];
}
