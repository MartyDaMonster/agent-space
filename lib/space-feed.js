import { getSql } from "./db.js";
import { formatUtc } from "./feed-query.js";
import { insertComment, insertHumanPost, insertPost, publicId, toggleReaction } from "./posts.js";
import { spaceAccess, spaceWritesOpen } from "./space-access.js";
import { resolveSpaceHandoff, resolveSpaceMentions } from "./space-targets.js";
import { spaceParticipants, spaceWriteAllowed } from "./spaces.js";

function presentPost(row) {
  return {
    id: row.id,
    type: row.type,
    from: row.from_slug,
    to: row.to_slug,
    text: row.body,
    createdAt: formatUtc(row.created_at),
    status: row.status,
    media: row.media,
    authorKind: row.author_kind || "bot",
    authorName: row.author_name || row.bot_name || row.from_slug,
    workspaceId: row.workspace_id,
    workspaceSlug: row.workspace_slug || "",
    workspaceName: row.workspace_name || "",
    hidden: Boolean(row.hidden_at),
    spaceId: row.space_id
  };
}

export async function listSpacePosts(spaceId, { includeHidden = false, limit = 50 } = {}) {
  const sql = getSql();
  const rows = await sql`
    select posts.id, posts.type, posts.from_slug, posts.to_slug, posts.body, posts.created_at,
           posts.status, posts.media, posts.author_kind, posts.author_name, posts.workspace_id,
           posts.hidden_at, posts.space_id,
           workspaces.slug as workspace_slug, workspaces.name as workspace_name,
           bots.name as bot_name
    from posts
    join workspaces on workspaces.id = posts.workspace_id
    left join bots on bots.workspace_id = posts.workspace_id and bots.slug = posts.from_slug
    where posts.space_id = ${spaceId}
      and posts.deleted_at is null
      and (${includeHidden}::boolean or posts.hidden_at is null)
    order by posts.created_at desc, posts.id asc
    limit ${limit}
  `;
  return rows.map(presentPost);
}

export async function findSpacePost(spaceId, postId, { includeHidden = false } = {}) {
  const sql = getSql();
  const rows = await sql`
    select posts.id, posts.type, posts.from_slug, posts.to_slug, posts.body, posts.created_at,
           posts.status, posts.author_kind, posts.author_name, posts.workspace_id,
           posts.hidden_at, posts.space_id, posts.deleted_at,
           workspaces.slug as workspace_slug, workspaces.name as workspace_name,
           bots.name as bot_name
    from posts
    join workspaces on workspaces.id = posts.workspace_id
    left join bots on bots.workspace_id = posts.workspace_id and bots.slug = posts.from_slug
    where posts.id = ${postId} and posts.space_id = ${spaceId}
    limit 1
  `;
  const row = rows[0];
  if (!row || row.deleted_at) return null;
  if (row.hidden_at && !includeHidden) return null;
  return presentPost(row);
}

export async function spaceThread(postIds, spaceId) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const comments = {};
  const reactions = {};
  if (!ids.length) return { comments, reactions };
  const sql = getSql();
  const commentRows = await sql`
    select comments.id, comments.post_id, comments.author_kind, comments.author_slug,
           comments.author_name, comments.body, comments.created_at,
           workspaces.slug as workspace_slug, workspaces.name as workspace_name
    from comments
    join posts on posts.id = comments.post_id and posts.workspace_id = comments.workspace_id
    left join workspaces on workspaces.id = comments.author_workspace_id
    where comments.post_id = any(${ids})
      and posts.space_id = ${spaceId}
      and comments.deleted_at is null
    order by comments.created_at asc, comments.id asc
  `;
  for (const row of commentRows) {
    const item = {
      id: row.id,
      postId: row.post_id,
      authorKind: row.author_kind,
      authorSlug: row.author_slug || "",
      authorName: row.author_name,
      text: row.body,
      createdAt: formatUtc(row.created_at),
      workspaceSlug: row.workspace_slug || "",
      workspaceName: row.workspace_name || ""
    };
    comments[row.post_id] = comments[row.post_id] || [];
    comments[row.post_id].push(item);
  }
  const reactionRows = await sql`
    select post_reactions.post_id, post_reactions.actor, post_reactions.emoji
    from post_reactions
    join posts on posts.id = post_reactions.post_id and posts.workspace_id = post_reactions.workspace_id
    where post_reactions.post_id = any(${ids})
      and posts.space_id = ${spaceId}
  `;
  for (const row of reactionRows) {
    reactions[row.post_id] = reactions[row.post_id] || [];
    reactions[row.post_id].push({ actor: row.actor, emoji: row.emoji });
  }
  return { comments, reactions };
}

async function storeMentions(table, id, workspaceId, slugs) {
  const sql = getSql();
  if (table === "post") {
    await sql`delete from post_mentions where workspace_id = ${workspaceId} and post_id = ${id}`;
    for (const slug of slugs) {
      await sql`
        insert into post_mentions (workspace_id, post_id, slug)
        values (${workspaceId}, ${id}, ${slug})
        on conflict do nothing
      `;
    }
    return;
  }
  await sql`delete from comment_mentions where comment_id = ${id}`;
  for (const slug of slugs) {
    await sql`
      insert into comment_mentions (comment_id, slug)
      values (${id}, ${slug})
      on conflict do nothing
    `;
  }
}

export async function prepareSpaceWrite({ spaceId, text, to, type, authorQualified }) {
  const people = await spaceParticipants(spaceId);
  const mentions = resolveSpaceMentions(text, people.bots, { excludeQualified: authorQualified });
  if (!mentions.ok) return mentions;
  let handoff = { ok: true, to: to || null };
  if (type === "handoff" || to) handoff = resolveSpaceHandoff(to, people.bots);
  if (!handoff.ok) return handoff;
  return { ok: true, mentions: mentions.mentions, to: handoff.to, people };
}

export async function addSpaceBotPost({ bot, space, post, fileIds = [] }) {
  const access = await spaceAccess({ kind: "bot", workspaceId: bot.workspaceId, slug: bot.slug }, space.id);
  if (!access.ok) return access;
  const open = spaceWritesOpen(access);
  if (!open.ok) return open;
  const qualified = await authorQualified(space.id, bot.workspaceId, bot.slug);
  const prepared = await prepareSpaceWrite({
    spaceId: space.id,
    text: post.text,
    to: post.to,
    type: post.type,
    authorQualified: qualified
  });
  if (!prepared.ok) return prepared;
  if (!(await spaceWriteAllowed({ spaceId: space.id, workspaceId: bot.workspaceId, slug: bot.slug }))) {
    return { ok: false, status: 429, error: "This space is receiving posts too quickly." };
  }
  const saved = await insertPost({
    ...post,
    to: prepared.to,
    projectId: null,
    workspaceId: bot.workspaceId,
    spaceId: space.id
  });
  const { attachFiles } = await import("./files.js");
  const attached = await attachFiles({
    ids: fileIds,
    workspaceId: bot.workspaceId,
    uploaderKind: "bot",
    uploaderId: bot.slug,
    postId: saved.id,
    spaceId: space.id
  });
  if (!attached.ok) {
    const { deletePostNow } = await import("./posts.js");
    await deletePostNow(saved.id, bot.workspaceId);
    return attached;
  }
  await storeMentions("post", saved.id, bot.workspaceId, prepared.mentions);
  return {
    ok: true,
    post: {
      ...saved,
      to: prepared.to,
      mentions: prepared.mentions,
      space: space.slug
    }
  };
}

async function authorQualified(spaceId, workspaceId, slug) {
  const people = await spaceParticipants(spaceId);
  return people.bots.find((bot) => bot.workspaceId === workspaceId && bot.slug === slug)?.qualified || "";
}

export async function addSpaceBotComment({ bot, space, post, text, fileIds = [] }) {
  const access = await spaceAccess({ kind: "bot", workspaceId: bot.workspaceId, slug: bot.slug }, space.id);
  if (!access.ok) return access;
  const open = spaceWritesOpen(access);
  if (!open.ok) return open;
  const qualified = await authorQualified(space.id, bot.workspaceId, bot.slug);
  const prepared = await prepareSpaceWrite({
    spaceId: space.id,
    text,
    authorQualified: qualified
  });
  if (!prepared.ok) return prepared;
  if (!(await spaceWriteAllowed({ spaceId: space.id, workspaceId: bot.workspaceId, slug: bot.slug }))) {
    return { ok: false, status: 429, error: "This space is receiving posts too quickly." };
  }
  const comment = await insertComment({
    id: publicId("cmt"),
    postId: post.id,
    workspaceId: post.workspaceId,
    authorKind: "bot",
    authorSlug: bot.slug,
    authorName: bot.name,
    text,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    spaceId: space.id,
    authorWorkspaceId: bot.workspaceId
  });
  const { attachFiles } = await import("./files.js");
  const attached = await attachFiles({
    ids: fileIds,
    workspaceId: bot.workspaceId,
    uploaderKind: "bot",
    uploaderId: bot.slug,
    commentId: comment.id,
    spaceId: space.id
  });
  if (!attached.ok) return attached;
  await storeMentions("comment", comment.id, post.workspaceId, prepared.mentions);
  return { ok: true, comment: { ...comment, mentions: prepared.mentions } };
}

export async function addSpaceReaction({ bot = null, post, actor, emoji }) {
  if (bot) {
    const access = await spaceAccess({ kind: "bot", workspaceId: bot.workspaceId, slug: bot.slug }, post.spaceId);
    if (!access.ok) return access;
    const open = spaceWritesOpen(access);
    if (!open.ok) return open;
  }
  const result = await toggleReaction({
    postId: post.id,
    actor,
    emoji,
    workspaceId: post.workspaceId,
    spaceId: post.spaceId
  });
  return { ok: true, ...result };
}

export async function addSpaceHumanPost({ person, space, text }) {
  const prepared = await prepareSpaceWrite({ spaceId: space.id, text, type: "message" });
  if (!prepared.ok) return prepared;
  const post = await insertHumanPost({
    id: publicId("note"),
    type: "message",
    from: "human",
    text,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    authorName: person.name,
    authorEmail: person.email,
    workspaceId: person.workspaceId,
    spaceId: space.id
  });
  await storeMentions("post", post.id, person.workspaceId, prepared.mentions);
  return { ok: true, post };
}

export async function spaceFiles(postIds, spaceId, viewer) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const posts = {};
  const comments = {};
  if (!ids.length) return { posts, comments };
  const sql = getSql();
  const rows = await sql`
    select id, post_id, comment_id, name, extension, content_type, byte_size,
           uploader_kind, uploader_id, deleted_at
    from board_files
    where space_id = ${spaceId}
      and (
        post_id = any(${ids})
        or comment_id in (
          select comments.id from comments
          where comments.space_id = ${spaceId} and comments.post_id = any(${ids})
        )
      )
    order by created_at asc
  `;
  const { presentFile } = await import("./files.js");
  for (const row of rows) {
    const card = presentFile(row, viewer);
    if (row.comment_id) {
      comments[row.comment_id] = comments[row.comment_id] || [];
      comments[row.comment_id].push(card);
    } else if (row.post_id) {
      posts[row.post_id] = posts[row.post_id] || [];
      posts[row.post_id].push(card);
    }
  }
  return { posts, comments };
}
