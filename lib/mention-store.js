import { getSql } from "./db.js";
import { listHumans } from "./humans.js";
import { mentionDirectory, mentionSlugFor, notifySlugs } from "./mentions.js";
import { listBots } from "./posts.js";

export async function directory(workspaceId = "") {
  const [bots, humans] = await Promise.all([listBots(workspaceId), listHumans(workspaceId)]);
  return mentionDirectory(bots, humans);
}

async function mentionTargetInWorkspace(table, id, workspaceId) {
  const sql = getSql();
  if (table === "post") {
    const rows = await sql`
      select id from posts where id = ${id} and workspace_id = ${workspaceId} limit 1
    `;
    return rows.length > 0;
  }
  const rows = await sql`
    select comments.id
    from comments
    join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
    where comments.id = ${id} and comments.workspace_id = ${workspaceId}
    limit 1
  `;
  return rows.length > 0;
}

export async function rememberMentions(table, id, text, author = {}, workspaceId = "") {
  if (!(await mentionTargetInWorkspace(table, id, workspaceId))) return [];
  const people = await directory(workspaceId);
  const slugs = notifySlugs(text, people, { exclude: [mentionSlugFor(author, people)] });
  const sql = getSql();
  if (table === "post") {
    await sql`
      delete from post_mentions
      where workspace_id = ${workspaceId} and post_id = ${id}
    `;
    for (const slug of slugs) {
      await sql`insert into post_mentions (workspace_id, post_id, slug) values (${workspaceId}, ${id}, ${slug}) on conflict do nothing`;
    }
  } else {
    await sql`
      delete from comment_mentions
      where comment_id = ${id}
        and comment_id in (
          select comments.id from comments
          join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
          where comments.id = ${id} and comments.workspace_id = ${workspaceId}
        )
    `;
    for (const slug of slugs) {
      await sql`insert into comment_mentions (comment_id, slug) values (${id}, ${slug}) on conflict do nothing`;
    }
  }
  return slugs;
}

export async function listMentionIndex(postIds, workspaceId = "") {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const postsById = {};
  const commentsById = {};
  if (!ids.length) return { postsById, commentsById };
  const sql = getSql();
  const postRows = await sql`
    select post_mentions.post_id, post_mentions.slug
    from post_mentions
    join posts on posts.id = post_mentions.post_id and posts.workspace_id = post_mentions.workspace_id
    where post_mentions.post_id = any(${ids})
      and post_mentions.workspace_id = ${workspaceId}
    order by post_mentions.slug asc
  `;
  for (const row of postRows) {
    postsById[row.post_id] = postsById[row.post_id] || [];
    postsById[row.post_id].push(row.slug);
  }
  const commentRows = await sql`
    select comments.id as comment_id, comment_mentions.slug
    from comment_mentions
    join comments on comments.id = comment_mentions.comment_id
    join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
    where comments.post_id = any(${ids})
      and comments.workspace_id = ${workspaceId}
      and comments.deleted_at is null
    order by comment_mentions.slug asc
  `;
  for (const row of commentRows) {
    commentsById[row.comment_id] = commentsById[row.comment_id] || [];
    commentsById[row.comment_id].push(row.slug);
  }
  return { postsById, commentsById };
}
