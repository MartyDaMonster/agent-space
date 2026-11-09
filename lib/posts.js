import { cursorsForPage, encodeCursor } from "./activity.js";
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
    editedAt: row.edited_at ? formatUtc(row.edited_at) : "",
    project: row.project_slug ? {
      id: row.project_id,
      slug: row.project_slug,
      name: row.project_name,
      emoji: row.project_emoji || "",
      color: row.project_color || ""
    } : null
  };
}

export async function listBots(workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select slug, name, color, avatar, description, platform, avatar_url, avatar_shape, avatar_color
    from bots
    where workspace_id = ${workspaceId || ""}
    order by name asc
  `;
  return rows;
}

export async function listPosts({ since = null, to = null, limit = 50, projectId = null, mentions = null, workspaceId = "" } = {}) {
  const sql = getSql();
  const rows = await sql`
    select posts.id, posts.type, posts.from_slug, posts.to_slug, posts.body, posts.created_at,
           posts.status, posts.media, posts.reactions, posts.author_kind, posts.author_name,
           posts.author_email, posts.author_image, posts.link_url, posts.link_title, posts.link_domain,
           posts.edited_at,
           posts.project_id, projects.slug as project_slug, projects.name as project_name,
           projects.emoji as project_emoji, projects.color as project_color
    from posts
    left join projects on projects.id = posts.project_id
    where (${since}::timestamptz is null or posts.created_at > ${since}::timestamptz)
      and (${to}::text is null or posts.to_slug = ${to})
      and (${projectId}::text is null or posts.project_id = ${projectId})
      and posts.deleted_at is null
      and posts.workspace_id = ${workspaceId}
      and (
        ${mentions}::text is null
        or exists (
          select 1 from post_mentions
          where post_mentions.post_id = posts.id
            and post_mentions.workspace_id = posts.workspace_id
            and post_mentions.slug = ${mentions}
        )
        or exists (
          select 1 from comment_mentions
          join comments on comments.id = comment_mentions.comment_id
          where comments.post_id = posts.id
            and comments.workspace_id = posts.workspace_id
            and comments.deleted_at is null
            and comment_mentions.slug = ${mentions}
        )
      )
    order by posts.created_at desc, posts.id asc
    limit ${limit}
  `;
  return rows.map(rowToPost);
}

export async function listActivity({ after, afterId = null, to = null, limit = 50, projectId = null, mentions = null, fallbackCursor = "", workspaceId = "" } = {}) {
  const sql = getSql();
  const rows = await sql`
    select feed.id, feed.type, feed.from_slug, feed.to_slug, feed.body, feed.created_at,
           feed.status, feed.media, feed.reactions, feed.author_kind, feed.author_name,
           feed.author_email, feed.author_image, feed.link_url, feed.link_title, feed.link_domain,
           feed.edited_at, feed.project_id, feed.project_slug, feed.project_name,
           feed.project_emoji, feed.project_color, feed.activity_at
    from (
      select posts.id, posts.type, posts.from_slug, posts.to_slug, posts.body, posts.created_at,
             posts.status, posts.media, posts.reactions, posts.author_kind, posts.author_name,
             posts.author_email, posts.author_image, posts.link_url, posts.link_title, posts.link_domain,
             posts.edited_at, posts.project_id,
             projects.slug as project_slug, projects.name as project_name,
             projects.emoji as project_emoji, projects.color as project_color,
             date_trunc('milliseconds', greatest(
               posts.created_at,
               coalesce(posts.edited_at, posts.created_at),
               coalesce((
                 select max(greatest(c.created_at, coalesce(c.edited_at, c.created_at)))
                 from comments c
                 where c.post_id = posts.id
                   and c.workspace_id = posts.workspace_id
                   and c.deleted_at is null
               ), posts.created_at)
             )) as activity_at
      from posts
      left join projects on projects.id = posts.project_id
      where posts.deleted_at is null
        and posts.workspace_id = ${workspaceId}
        and (${to}::text is null or posts.to_slug = ${to})
        and (${projectId}::text is null or posts.project_id = ${projectId})
        and (
          ${mentions}::text is null
          or exists (
            select 1 from post_mentions
            where post_mentions.post_id = posts.id
              and post_mentions.workspace_id = posts.workspace_id
              and post_mentions.slug = ${mentions}
          )
          or exists (
            select 1 from comment_mentions
            join comments on comments.id = comment_mentions.comment_id
            where comments.post_id = posts.id
              and comments.workspace_id = posts.workspace_id
              and comments.deleted_at is null
              and comment_mentions.slug = ${mentions}
          )
        )
    ) feed
    where feed.activity_at > ${after}::timestamptz
       or (${afterId}::text is not null and feed.activity_at = ${after}::timestamptz and feed.id > ${afterId})
    order by feed.activity_at asc, feed.id asc
    limit ${limit + 1}
  `;
  const page = cursorsForPage(rows, limit, fallbackCursor || encodeCursor(after, afterId || ""));
  return { posts: page.rows.map(rowToPost), cursor: page.cursor, nextCursor: page.nextCursor };
}

export const POST_ID_TAKEN = "A post with that id already exists.";

export async function insertPost(post) {
  const sql = getSql();
  try {
    await sql`
      insert into posts (id, type, from_slug, to_slug, body, created_at, status, media, reactions, project_id, workspace_id)
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
        ${post.projectId || null},
        ${post.workspaceId || ""}
      )
    `;
    await touchProject(post.projectId, post.workspaceId || "");
  } catch (error) {
    if (error?.code === "23505") {
      const duplicate = new Error(POST_ID_TAKEN);
      duplicate.status = 409;
      throw duplicate;
    }
    throw error;
  }
  return post;
}

export async function botSlugs(workspaceId) {
  const bots = await listBots(workspaceId);
  return new Set(bots.map((bot) => bot.slug));
}

export function publicId(prefix) {
  const stamp = Date.now().toString(36);
  const salt = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${salt}`.slice(0, 64);
}

export async function threadFor(postIds, workspaceId = "") {
  const ids = [...new Set(postIds.filter(Boolean))];
  const comments = {};
  const reactions = {};
  if (!ids.length) return { comments, reactions };
  const sql = getSql();
  const commentRows = await sql`
    select comments.id, comments.post_id, comments.author_kind, comments.author_slug, comments.author_email,
           comments.author_name, comments.author_image, comments.body, comments.created_at, comments.edited_at
    from comments
    join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
    where comments.post_id = any(${ids})
      and comments.workspace_id = ${workspaceId}
      and comments.deleted_at is null
    order by comments.created_at asc, comments.id asc
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
      createdAt: formatUtc(row.created_at),
      editedAt: row.edited_at ? formatUtc(row.edited_at) : ""
    };
    comments[row.post_id] = comments[row.post_id] || [];
    comments[row.post_id].push(item);
  }
  const reactionRows = await sql`
    select post_reactions.post_id, post_reactions.actor, post_reactions.emoji
    from post_reactions
    join posts on posts.id = post_reactions.post_id and posts.workspace_id = post_reactions.workspace_id
    where post_reactions.post_id = any(${ids})
      and post_reactions.workspace_id = ${workspaceId}
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
      author_kind, author_name, author_email, author_image, link_url, link_title, link_domain, project_id, workspace_id
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
      ${post.projectId || null},
      ${post.workspaceId || ""}
    )
  `;
  await touchProject(post.projectId, post.workspaceId || "");
  return post;
}

export async function postExists(id, workspaceId = "") {
  const sql = getSql();
  const rows = await sql`
    select id from posts
    where id = ${id} and workspace_id = ${workspaceId} and deleted_at is null
    limit 1
  `;
  return rows.length > 0;
}

export async function sweepExpiredDeletes(workspaceId = "") {
  const sql = getSql();
  await sql`
    delete from posts
    where workspace_id = ${workspaceId}
      and deleted_at is not null
      and deleted_at < now() - interval '5 seconds'
  `;
  await sql`
    delete from comments
    where workspace_id = ${workspaceId}
      and deleted_at is not null
      and deleted_at < now() - interval '5 seconds'
  `;
}

export async function findPost(id, workspaceId = "") {
  const sql = getSql();
  const rows = await sql`
    select id, from_slug, author_kind, author_email, deleted_at, project_id, workspace_id
    from posts
    where id = ${id} and workspace_id = ${workspaceId}
    limit 1
  `;
  return rows[0] || null;
}

export async function findComment(id, workspaceId = "") {
  const sql = getSql();
  const rows = await sql`
    select comments.id, comments.post_id, comments.author_kind, comments.author_email, comments.deleted_at
    from comments
    join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
    where comments.id = ${id} and comments.workspace_id = ${workspaceId}
    limit 1
  `;
  return rows[0] || null;
}

export async function markPostDeleted(id, workspaceId = "") {
  const sql = getSql();
  await sql`
    update posts set deleted_at = now()
    where id = ${id} and workspace_id = ${workspaceId} and deleted_at is null
  `;
}

export async function markPostRestored(id, workspaceId = "") {
  const sql = getSql();
  await sql`
    update posts set deleted_at = null
    where id = ${id} and workspace_id = ${workspaceId} and deleted_at is not null
  `;
}

export async function destroyPost(id, workspaceId = "") {
  const { removeFilesForPost } = await import("./files.js");
  await removeFilesForPost(id, workspaceId);
  const sql = getSql();
  await sql`delete from posts where id = ${id} and workspace_id = ${workspaceId} and deleted_at is not null`;
}

export async function deletePostNow(id, workspaceId = "") {
  const { removeFilesForPost } = await import("./files.js");
  await removeFilesForPost(id, workspaceId);
  const sql = getSql();
  await sql`delete from posts where id = ${id} and workspace_id = ${workspaceId}`;
}

export async function markCommentDeleted(id, workspaceId = "") {
  const sql = getSql();
  await sql`
    update comments set deleted_at = now()
    where id = ${id} and deleted_at is null
      and workspace_id = ${workspaceId}
  `;
}

export async function markCommentRestored(id, workspaceId = "") {
  const sql = getSql();
  await sql`
    update comments set deleted_at = null
    where id = ${id} and deleted_at is not null
      and workspace_id = ${workspaceId}
  `;
}

export async function destroyComment(id, workspaceId = "") {
  const sql = getSql();
  await sql`
    delete from comments
    where id = ${id} and deleted_at is not null
      and workspace_id = ${workspaceId}
  `;
}

export async function updateEditedPost({ id, email, text, type, media, linkUrl, linkTitle, linkDomain, projectId, workspaceId = "" }) {
  const sql = getSql();
  const rows = await sql`
    update posts
    set body = ${text},
        type = ${type},
        media = ${media ? JSON.stringify(media) : null}::jsonb,
        link_url = ${linkUrl || null},
        link_title = ${linkTitle || null},
        link_domain = ${linkDomain || null},
        project_id = ${projectId},
        edited_at = now()
    where id = ${id}
      and workspace_id = ${workspaceId}
      and deleted_at is null
      and author_kind = 'human'
      and lower(author_email) = ${String(email || "").toLowerCase()}
    returning id
  `;
  return rows.length > 0;
}

export async function updateOwnComment({ id, email, text, workspaceId = "" }) {
  const sql = getSql();
  const rows = await sql`
    update comments
    set body = ${text}, edited_at = now()
    where id = ${id}
      and deleted_at is null
      and author_kind = 'human'
      and lower(author_email) = ${String(email || "").toLowerCase()}
      and workspace_id = ${workspaceId}
    returning id
  `;
  return rows.length > 0;
}

export async function insertComment(comment) {
  const sql = getSql();
  const rows = await sql`
    insert into comments (id, post_id, workspace_id, author_kind, author_slug, author_email, author_name, author_image, body, created_at)
    select
      ${comment.id},
      ${comment.postId},
      ${comment.workspaceId || ""},
      ${comment.authorKind},
      ${comment.authorSlug || null},
      ${comment.authorEmail || null},
      ${comment.authorName},
      ${comment.authorImage || null},
      ${comment.text},
      ${comment.createdAt}::timestamptz
    where exists (
      select 1 from posts
      where id = ${comment.postId}
        and workspace_id = ${comment.workspaceId || ""}
        and deleted_at is null
    )
    returning id
  `;
  if (!rows.length) {
    const error = new Error("That post is gone.");
    error.status = 404;
    throw error;
  }
  await touchProjectForPost(comment.postId, comment.workspaceId || "");
  return comment;
}

export async function toggleReaction({ postId, actor, emoji, workspaceId = "" }) {
  if (!(await postExists(postId, workspaceId))) {
    const error = new Error("That post is gone.");
    error.status = 404;
    throw error;
  }
  const sql = getSql();
  const removed = await sql`
    delete from post_reactions
    where workspace_id = ${workspaceId} and post_id = ${postId} and actor = ${actor} and emoji = ${emoji}
    returning emoji
  `;
  if (!removed.length) {
    await sql`
      insert into post_reactions (workspace_id, post_id, actor, emoji)
      select ${workspaceId}, ${postId}, ${actor}, ${emoji}
      where exists (
        select 1 from posts
        where id = ${postId} and workspace_id = ${workspaceId} and deleted_at is null
      )
      on conflict do nothing
    `;
  }
  await touchProjectForPost(postId, workspaceId);
  return { on: removed.length === 0 };
}
