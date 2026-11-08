const EPOCH = "1970-01-01T00:00:00.000Z";
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function activityAt(post) {
  const times = [post.createdAt, post.editedAt];
  for (const comment of post.comments || []) {
    if (comment.deletedAt) continue;
    times.push(comment.createdAt, comment.editedAt);
  }
  let max = null;
  for (const value of times) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!max || date > max) max = date;
  }
  return max ? max.toISOString() : "";
}

export function encodeCursor(at, id = "") {
  const iso = at instanceof Date ? at.toISOString() : new Date(at).toISOString();
  const payload = Buffer.from(JSON.stringify({ at: iso, id: id || "" }), "utf8").toString("base64url");
  return `v1.${payload}`;
}

export function decodeCursor(value) {
  if (value == null || value === "") return { at: EPOCH, id: null };
  if (TIMESTAMP.test(value)) return { at: new Date(value).toISOString(), id: null };
  if (!value.startsWith("v1.")) return null;
  try {
    const json = JSON.parse(Buffer.from(value.slice(3), "base64url").toString("utf8"));
    if (!json || typeof json.at !== "string" || Number.isNaN(Date.parse(json.at))) return null;
    if (json.id != null && typeof json.id !== "string") return null;
    return { at: new Date(json.at).toISOString(), id: json.id || null };
  } catch {
    return null;
  }
}

export function isAfterCursor(at, id, cursor) {
  const when = new Date(at).getTime();
  const mark = new Date(cursor.at).getTime();
  if (Number.isNaN(when) || Number.isNaN(mark)) return false;
  if (when > mark) return true;
  if (when < mark || !cursor.id) return false;
  return id > cursor.id;
}

export function activityPage(posts, { cursor = "", limit = 50 } = {}) {
  const decoded = decodeCursor(cursor);
  const ranked = posts
    .filter((post) => !post.deletedAt)
    .map((post) => ({ post, at: activityAt(post) }))
    .filter((item) => item.at && isAfterCursor(item.at, item.post.id, decoded))
    .sort((a, b) => a.at === b.at ? a.post.id.localeCompare(b.post.id) : a.at < b.at ? -1 : 1);
  const page = ranked.slice(0, limit);
  const last = page.at(-1);
  const position = last ? encodeCursor(last.at, last.post.id) : (cursor || encodeCursor(decoded.at, ""));
  return {
    posts: page.map((item) => item.post),
    cursor: position,
    nextCursor: ranked.length > limit ? position : null
  };
}

export function cursorsForPage(rows, limit, fallbackCursor) {
  const page = rows.slice(0, limit);
  if (!page.length) return { rows: page, cursor: fallbackCursor, nextCursor: null };
  const last = page.at(-1);
  const cursor = encodeCursor(last.activity_at, last.id);
  return { rows: page, cursor, nextCursor: rows.length > limit ? cursor : null };
}
