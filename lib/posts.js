import { getSql } from "./db.js";
import { formatUtc, parseFeedQuery } from "./feed-query.js";
import { touchProject, touchProjectForPost } from "./projects.js";

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
    linkDomain: row.link_domain || "",
    project: row.project_slug ? {
      id: row.project_id,
      slug: row.project_slug,
      name: row.project_name,
      emoji: row.project_emoji || "",
      color: row.project_color || ""
    } : null
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

export async function listPosts({ since = null, to = null, limit = 50, projectId = null } = {}) {
  const sql = getSql();
  const rows = await sql`
    select posts.id, posts.type, posts.from_slug, posts.to_slug, posts.body, posts.created_at,
           posts.status, posts.media, posts.reactions, posts.author_kind, posts.author_name,
           posts.author_email, posts.author_image, posts.link_url, posts.link_title, posts.link_domain,
           posts.project_id, projects.slug as project_slug, projects.name as project_name,
           projects.emoji as project_emoji, projects.color as project_color
    from posts
    left join projects on projects.id = posts.project_id
    where (${since}::timestamptz is null or posts.created_at > ${since}::timestamptz)
      and (${to}::text is null or posts.to_slug = ${to})
      and (${projectId}::text is null or posts.project_id = ${projectId})
      and posts.deleted_at is null
    order by posts.created_at desc, posts.id asc
    limit ${limit}
  `;
  return rows.map(rowToPost);
}

export async function insertPost(post) {
  const sql = getSql();
  try {
    await sql`
      insert into posts (id, type, from_slug, to_slug, body, created_at, status, media, reactions, project_id)
      values (
        ${post.id},
        ${post.type},
        ${post.from},
        ${post.to},
        ${post.text},
        ${post.createdAt}::timestamptz,
        ${post.status},
        ${post.media ? JSON.stringify(post.media) : null}::jsonb,
        ${JSON.stringify(post.reactions || {})}::jsonb,
        ${post.projectId || null}
      )
    `;
    await touchProject(post.projectId);
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
      and deleted_at is null
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
      author_kind, author_name, author_email, author_image, link_url, link_title, link_domain, project_id
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
      ${post.linkDomain || null},
      ${post.projectId || null}
    )
  `;
  await touchProject(post.projectId);
  return post;
}

export async function postExists(id) {
  const sql = getSql();
  const rows = await sql`select id from posts where id = ${id} and deleted_at is null limit 1`;
  return rows.length > 0;
}

export async function sweepExpiredDeletes() {
  const sql = getSql();
  await sql`
    delete from posts
    where deleted_at is not null
      and deleted_at < now() - interval '5 seconds'
  `;
  await sql`
    delete from comments
    where deleted_at is not null
      and deleted_at < now() - interval '5 seconds'
  `;
}

export async function findPost(id) {
  const sql = getSql();
  const rows = await sql`
    select id, from_slug, author_kind, author_email, deleted_at
    from posts
    where id = ${id}
    limit 1
  `;
  return rows[0] || null;
}

export async function findComment(id) {
  const sql = getSql();
  const rows = await sql`
    select id, author_email, deleted_at
    from comments
    where id = ${id}
    limit 1
  `;
  return rows[0] || null;
}

export async function markPostDeleted(id) {
  const sql = getSql();
  await sql`update posts set deleted_at = now() where id = ${id} and deleted_at is null`;
}

export async function markPostRestored(id) {
  const sql = getSql();
  await sql`update posts set deleted_at = null where id = ${id} and deleted_at is not null`;
}

export async function destroyPost(id) {
  const sql = getSql();
  await sql`delete from posts where id = ${id} and deleted_at is not null`;
}

export async function deletePostNow(id) {
  const sql = getSql();
  await sql`delete from posts where id = ${id}`;
}

export async function markCommentDeleted(id) {
  const sql = getSql();
  await sql`update comments set deleted_at = now() where id = ${id} and deleted_at is null`;
}

export async function markCommentRestored(id) {
  const sql = getSql();
  await sql`update comments set deleted_at = null where id = ${id} and deleted_at is not null`;
}

export async function destroyComment(id) {
  const sql = getSql();
  await sql`delete from comments where id = ${id} and deleted_at is not null`;
}

export async function updatePostText(id, text) {
  const sql = getSql();
  const rows = await sql`
    update posts
    set body = ${text}
    where id = ${id} and deleted_at is null
    returning id
  `;
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
  await touchProjectForPost(comment.postId);
  return comment;
}

export async function toggleReaction({ postId, actor, emoji }) {
  const sql = getSql();
  const removed = await sql`
    delete from post_reactions
    where post_id = ${postId} and actor = ${actor} and emoji = ${emoji}
    returning emoji
  `;
  if (!removed.length) {
    await sql`
      insert into post_reactions (post_id, actor, emoji)
      values (${postId}, ${actor}, ${emoji})
      on conflict do nothing
    `;
  }
  await touchProjectForPost(postId);
  return { on: removed.length === 0 };
}
