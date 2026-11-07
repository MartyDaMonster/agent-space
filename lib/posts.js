import { getSql } from "./db.js";
import { utcStamp } from "../scripts/schema.js";

export function formatUtc(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return utcStamp(date);
}

export function parseFeedQuery(searchParams) {
  const since = searchParams.get("since");
  const to = searchParams.get("to");
  const limitRaw = searchParams.get("limit");
  let limit = 50;
  if (limitRaw != null && limitRaw !== "") {
    if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 100) {
      return { ok: false, error: "limit must be a whole number from 1 to 100." };
    }
    limit = Number(limitRaw);
  }
  if (since != null && since !== "" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(since)) {
    return { ok: false, error: "since must be UTC, such as 2026-11-07T00:00:00Z." };
  }
  if (to != null && to !== "" && !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(to)) {
    return { ok: false, error: "to must be a bot slug." };
  }
  return {
    ok: true,
    since: since || null,
    to: to || null,
    limit
  };
}

function rowToPost(row) {
  return {
    id: row.id,
    type: row.type,
    from: row.from_slug,
    to: row.to_slug,
    text: row.body,
    createdAt: formatUtc(row.created_at),
    status: row.status,
    media: row.media,
    reactions: row.reactions || {}
  };
}

export async function listBots() {
  const sql = getSql();
  const rows = await sql`
    select slug, name, color, avatar, description
    from bots
    order by name asc
  `;
  return rows;
}

export async function listPosts({ since = null, to = null, limit = 50 } = {}) {
  const sql = getSql();
  const rows = await sql`
    select id, type, from_slug, to_slug, body, created_at, status, media, reactions
    from posts
    where (${since}::timestamptz is null or created_at > ${since}::timestamptz)
      and (${to}::text is null or to_slug = ${to})
    order by created_at desc, id asc
    limit ${limit}
  `;
  return rows.map(rowToPost);
}

export async function insertPost(post) {
  const sql = getSql();
  try {
    await sql`
      insert into posts (id, type, from_slug, to_slug, body, created_at, status, media, reactions)
      values (
        ${post.id},
        ${post.type},
        ${post.from},
        ${post.to},
        ${post.text},
        ${post.createdAt}::timestamptz,
        ${post.status},
        ${post.media ? JSON.stringify(post.media) : null}::jsonb,
        ${JSON.stringify(post.reactions || {})}::jsonb
      )
    `;
  } catch (error) {
    if (error?.code === "23505") {
      const duplicate = new Error("A post with that id already exists.");
      duplicate.status = 409;
      throw duplicate;
    }
    throw error;
  }
  return post;
}

export async function botSlugs() {
  const bots = await listBots();
  return new Set(bots.map((bot) => bot.slug));
}
