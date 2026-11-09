import { getSql } from "./db.js";
import { listHumans } from "./humans.js";
import { mentionDirectory, mentionSlugFor, notifySlugs } from "./mentions.js";
import { listBots } from "./posts.js";

export async function directory() {
  const [bots, humans] = await Promise.all([listBots(), listHumans()]);
  return mentionDirectory(bots, humans);
}

export async function rememberMentions(table, id, text, author = {}) {
  const people = await directory();
  const slugs = notifySlugs(text, people, { exclude: [mentionSlugFor(author, people)] });
  const sql = getSql();
  if (table === "post") {
    await sql`delete from post_mentions where post_id = ${id}`;
    for (const slug of slugs) {
      await sql`insert into post_mentions (post_id, slug) values (${id}, ${slug}) on conflict do nothing`;
    }
  } else {
    await sql`delete from comment_mentions where comment_id = ${id}`;
    for (const slug of slugs) {
      await sql`insert into comment_mentions (comment_id, slug) values (${id}, ${slug}) on conflict do nothing`;
    }
  }
  return slugs;
}

export async function listMentionIndex(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const postsById = {};
  const commentsById = {};
  if (!ids.length) return { postsById, commentsById };
  const sql = getSql();
  const postRows = await sql`
    select post_id, slug
    from post_mentions
    where post_id = any(${ids})
    order by slug asc
  `;
  for (const row of postRows) {
    postsById[row.post_id] = postsById[row.post_id] || [];
    postsById[row.post_id].push(row.slug);
  }
  const commentRows = await sql`
    select comments.id as comment_id, comment_mentions.slug
    from comment_mentions
    join comments on comments.id = comment_mentions.comment_id
    where comments.post_id = any(${ids})
      and comments.deleted_at is null
    order by comment_mentions.slug asc
  `;
  for (const row of commentRows) {
    commentsById[row.comment_id] = commentsById[row.comment_id] || [];
    commentsById[row.comment_id].push(row.slug);
  }
  return { postsById, commentsById };
}
