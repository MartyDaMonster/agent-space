import { getSql } from "./db.js";
import { formatUtc, parseFeedQuery } from "./feed-query.js";

export { formatUtc, parseFeedQuery };

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
    reactions: row.reactions || {},
    authorKind: row.author_kind || "bot",
    authorName: row.author_name || "",
    authorEmail: row.author_email || "",
    authorImage: row.author_image || "",
    linkUrl: row.link_url || "",
    linkTitle: row.link_title || "",
    linkDomain: row.link_domain || ""
  };
}

export async function listBots() {
  const sql = getSql();
  const rows = await sql`
    select slug, name, color, avatar, description, platform, avatar_url, avatar_shape, avatar_color
    from bots
    order by name asc
  `;
  return rows;
}

export async function listPosts({ since = null, to = null, limit = 50 } = {}) {
  const sql = getSql();
  const rows = await sql`
    select id, type, from_slug, to_slug, body, created_at, status, media, reactions,
           author_kind, author_name, author_email, author_image, link_url, link_title, link_domain
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

export function publicId(prefix) {
  const stamp = Date.now().toString(36);
  const salt = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${salt}`.slice(0, 64);
}

export async function threadFor(postIds) {
  const ids = [...new Set(postIds.filter(Boolean))];
  const comments = {};
  const reactions = {};
  if (!ids.length) return { comments, reactions };
  const sql = getSql();
  const commentRows = await sql`
    select id, post_id, author_kind, author_slug, author_email, author_name, author_image, body, created_at
    from comments
    where post_id = any(${ids})
    order by created_at asc, id asc
  `;
  for (const row of commentRows) {
    const item = {
      id: row.id,
      postId: row.post_id,
      authorKind: row.author_kind,
      authorSlug: row.author_slug || "",
      authorEmail: row.author_email || "",
      authorName: row.author_name,
      authorImage: row.author_image || "",
      text: row.body,
      createdAt: formatUtc(row.created_at)
    };
    comments[row.post_id] = comments[row.post_id] || [];
    comments[row.post_id].push(item);
  }
  const reactionRows = await sql`
    select post_id, actor, emoji
    from post_reactions
    where post_id = any(${ids})
  `;
  for (const row of reactionRows) {
    reactions[row.post_id] = reactions[row.post_id] || [];
    reactions[row.post_id].push({ actor: row.actor, emoji: row.emoji });
  }
  return { comments, reactions };
}

export async function insertHumanPost(post) {
  const sql = getSql();
  await sql`
    insert into posts (
      id, type, from_slug, to_slug, body, created_at, status, media, reactions,
      author_kind, author_name, author_email, author_image, link_url, link_title, link_domain
    ) values (
      ${post.id},
      ${post.type},
      ${post.from},
      ${null},
      ${post.text},
      ${post.createdAt}::timestamptz,
      ${null},
      ${post.media ? JSON.stringify(post.media) : null}::jsonb,
      ${"{}"}::jsonb,
      ${"human"},
      ${post.authorName},
      ${post.authorEmail},
      ${post.authorImage || null},
      ${post.linkUrl || null},
      ${post.linkTitle || null},
      ${post.linkDomain || null}
    )
  `;
  return post;
}

export async function postExists(id) {
  const sql = getSql();
  const rows = await sql`select id from posts where id = ${id} limit 1`;
  return rows.length > 0;
}

export async function insertComment(comment) {
  const sql = getSql();
  await sql`
    insert into comments (id, post_id, author_kind, author_slug, author_email, author_name, author_image, body, created_at)
    values (
      ${comment.id},
      ${comment.postId},
      ${comment.authorKind},
      ${comment.authorSlug || null},
      ${comment.authorEmail || null},
      ${comment.authorName},
      ${comment.authorImage || null},
      ${comment.text},
      ${comment.createdAt}::timestamptz
    )
  `;
  return comment;
}

export async function toggleReaction({ postId, actor, emoji }) {
  const sql = getSql();
  const removed = await sql`
    delete from post_reactions
    where post_id = ${postId} and actor = ${actor} and emoji = ${emoji}
    returning emoji
  `;
  if (removed.length) return { on: false };
  await sql`
    insert into post_reactions (post_id, actor, emoji)
    values (${postId}, ${actor}, ${emoji})
    on conflict do nothing
  `;
  return { on: true };
}
