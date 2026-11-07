import { classifyMedia } from "./media.js";

export const STATUSES = ["queued", "sent", "delivered", "acknowledged"];
export const POST_TYPES = ["message", "handoff", "media"];
export const GLYPHS = ["spark", "waves", "hex"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanReactions(value, issues, id) {
  if (value == null) return {};
  if (!isObject(value)) {
    issues.push({ level: "error", id, message: "Reactions must be an object of emoji counts." });
    return null;
  }
  const reactions = {};
  for (const [key, count] of Object.entries(value)) {
    if (!key || key.length > 16 || /[<>&"'/\\]/.test(key)) {
      issues.push({ level: "error", id, message: "A reaction name is empty, too long, or unsafe." });
      return null;
    }
    if (!Number.isInteger(count) || count < 0 || count > 1000000) {
      issues.push({ level: "error", id, message: `Reaction ${key} must be a whole number from 0 to 1000000.` });
      return null;
    }
    reactions[key] = count;
  }
  return reactions;
}

function inspectBot(raw, index, issues, seen) {
  const label = `Bot ${index + 1}`;
  if (!isObject(raw)) {
    issues.push({ level: "error", message: `${label} is not an object.` });
    return null;
  }
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const color = typeof raw.color === "string" ? raw.color.trim() : "";
  const avatar = typeof raw.avatar === "string" ? raw.avatar.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push({ level: "error", message: `${label} needs a lowercase slug.` });
    return null;
  }
  if (seen.has(slug)) {
    issues.push({ level: "error", id: slug, message: `Duplicate bot slug ${slug}.` });
    return null;
  }
  seen.add(slug);
  if (!name || name.length > 40) {
    issues.push({ level: "error", id: slug, message: `${slug} needs a name of 1 to 40 characters.` });
    return null;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    issues.push({ level: "error", id: slug, message: `${slug} needs a #rrggbb color.` });
    return null;
  }
  if (!avatar || avatar.length > 80 || /[<>"'\\]/.test(avatar)) {
    issues.push({ level: "error", id: slug, message: `${slug} has an unusable avatar value.` });
    return null;
  }
  if (!description || description.length > 200) {
    issues.push({ level: "error", id: slug, message: `${slug} needs a description of 1 to 200 characters.` });
    return null;
  }
  return { slug, name, color, avatar, description };
}

function inspectPost(raw, index, issues, slugs, seenIds) {
  const label = `Post ${index + 1}`;
  if (!isObject(raw)) {
    issues.push({ level: "error", message: `${label} is not an object.` });
    return null;
  }
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    issues.push({ level: "error", message: `${label} needs an id of lowercase letters, numbers, and hyphens.` });
    return null;
  }
  if (seenIds.has(id)) {
    issues.push({ level: "error", id, message: `Duplicate post id ${id}.` });
    return null;
  }
  seenIds.add(id);
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!POST_TYPES.includes(type)) {
    issues.push({ level: "error", id, message: `${id} type must be message, handoff, or media.` });
    return null;
  }
  const from = typeof raw.from === "string" ? raw.from.trim() : "";
  const to = raw.to == null ? "" : (typeof raw.to === "string" ? raw.to.trim() : null);
  if (!from) {
    issues.push({ level: "error", id, message: `${id} is missing from.` });
    return null;
  }
  if (to === null) {
    issues.push({ level: "error", id, message: `${id} has an unusable to value.` });
    return null;
  }
  if (!slugs.has(from)) issues.push({ level: "warning", id, message: `${id} from "${from}" is not in bots.json. The page uses a neutral avatar.` });
  if (to && !slugs.has(to)) issues.push({ level: "warning", id, message: `${id} to "${to}" is not in bots.json. The page uses a neutral avatar.` });
  if (type === "handoff" && !to) {
    issues.push({ level: "error", id, message: `${id} is a handoff and needs a to slug.` });
    return null;
  }
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text || text.length > 500) {
    issues.push({ level: "error", id, message: `${id} text must be 1 to 500 characters.` });
    return null;
  }
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
    issues.push({ level: "error", id, message: `${id} createdAt must be ISO 8601 UTC, such as 2026-11-06T14:05:00Z.` });
    return null;
  }
  let status = "";
  if (type === "handoff") {
    status = typeof raw.status === "string" ? raw.status.trim() : "";
    if (!STATUSES.includes(status)) {
      issues.push({ level: "error", id, message: `${id} status must be queued, sent, delivered, or acknowledged.` });
      return null;
    }
  } else if (raw.status != null) {
    issues.push({ level: "error", id, message: `${id} should not include status unless it is a handoff.` });
    return null;
  }
  let media = null;
  if (raw.media != null) {
    const classified = classifyMedia(raw.media);
    if (!classified.ok) {
      issues.push({ level: "error", id, message: `${id} media was rejected. ${classified.reason}` });
      return null;
    }
    media = classified;
  } else if (type === "media") {
    issues.push({ level: "error", id, message: `${id} is a media post and needs a media object.` });
    return null;
  }
  const reactions = cleanReactions(raw.reactions, issues, id);
  if (!reactions) return null;
  return { id, type, from, to, text, createdAt, status, media, reactions };
}

export function utcStamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function validateApiPost(raw, { from, createdAt, slugs }) {
  if (!isObject(raw)) return { ok: false, status: 400, error: "Post body must be a JSON object." };
  if (Object.prototype.hasOwnProperty.call(raw, "createdAt")) {
    return { ok: false, status: 400, error: "createdAt is set by the server." };
  }
  if (raw.from != null && String(raw.from).trim() !== from) {
    return { ok: false, status: 403, error: "from must match this bot key." };
  }
  const issues = [];
  const post = inspectPost({ ...raw, from, createdAt }, 0, issues, slugs instanceof Set ? slugs : new Set(slugs || []), new Set());
  const errors = issues.filter((issue) => issue.level === "error");
  if (!post || errors.length) {
    return { ok: false, status: 400, error: errors[0]?.message || "Post was rejected." };
  }
  const media = post.media ? (({ ok, ...rest }) => rest)(post.media) : null;
  return {
    ok: true,
    post: {
      ...post,
      to: post.to || null,
      status: post.status || null,
      media
    },
    warnings: issues.filter((issue) => issue.level === "warning")
  };
}

export function inspectDocuments(botsDoc, feedDoc) {
  const issues = [];
  if (!isObject(botsDoc) || botsDoc.schemaVersion !== 1 || !Array.isArray(botsDoc.bots)) {
    return { fatal: "data/bots.json must be a schemaVersion 1 object with a bots array.", issues, bots: [], posts: [] };
  }
  if (!isObject(feedDoc) || feedDoc.schemaVersion !== 1 || !Array.isArray(feedDoc.posts)) {
    return { fatal: "data/feed.json must be a schemaVersion 1 object with a posts array.", issues, bots: [], posts: [] };
  }
  const seen = new Set();
  const bots = [];
  botsDoc.bots.forEach((raw, index) => {
    const bot = inspectBot(raw, index, issues, seen);
    if (bot) bots.push(bot);
  });
  const slugs = new Set(bots.map((bot) => bot.slug));
  const seenIds = new Set();
  const posts = [];
  feedDoc.posts.forEach((raw, index) => {
    const post = inspectPost(raw, index, issues, slugs, seenIds);
    if (post) posts.push(post);
  });
  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return {
    fatal: null,
    label: typeof feedDoc.label === "string" ? feedDoc.label.trim() : "",
    notice: typeof feedDoc.notice === "string" ? feedDoc.notice.trim() : "",
    issues,
    bots,
    posts
  };
}

export function buildMessages(feedDoc, posts, bots) {
  const bySlug = new Map(bots.map((bot) => [bot.slug, bot]));
  const messages = posts
    .filter((post) => post.type === "handoff")
    .map((post) => ({
      id: post.id,
      from: bySlug.get(post.from)?.name || post.from,
      to: bySlug.get(post.to)?.name || post.to,
      timestamp: post.createdAt,
      status: post.status,
      summary: post.text
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  return {
    _generated: true,
    schemaVersion: 1,
    label: typeof feedDoc.label === "string" ? feedDoc.label.trim() : "",
    source: "data/feed.json",
    notice: "Generated from handoff posts in data/feed.json. Do not edit this file. Change data/feed.json, then run node scripts/validate.mjs --write.",
    messages
  };
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonical(value[key]);
    return sorted;
  }
  return value;
}

export function sameJson(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
