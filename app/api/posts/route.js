import { requireBot } from "@/lib/api-bot";
import { listHumans } from "@/lib/humans";
import { listMentionIndex, rememberMentions } from "@/lib/mention-store";
import { exposeMentions } from "@/lib/mentions";
import { decodeCursor, encodeCursor } from "@/lib/activity";
import { botSlugs, insertPost, listActivity, listBots, listPosts, parseFeedQuery, sweepExpiredDeletes, threadFor } from "@/lib/posts";
import { countReactionRows, namesForReactions } from "@/lib/reactions";
import { projectBySlug } from "@/lib/projects";
import { utcStamp, validateApiPost } from "@/scripts/schema.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const parsed = parseFeedQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  let projectId = null;
  if (parsed.project) {
    const project = await projectBySlug(parsed.project, authResult.bot.workspaceId);
    if (!project) return Response.json({ error: "That project was not found." }, { status: 404 });
    projectId = project.id;
  }
  await sweepExpiredDeletes(authResult.bot.workspaceId);
  let activity = null;
  let posts;
  if (parsed.cursor != null) {
    const decoded = decodeCursor(parsed.cursor);
    activity = await listActivity({
      after: decoded.at,
      afterId: decoded.id,
      to: parsed.to,
      limit: parsed.limit,
      projectId,
      mentions: parsed.mentions,
      workspaceId: authResult.bot.workspaceId,
      fallbackCursor: parsed.cursor || encodeCursor(decoded.at, "")
    });
    posts = activity.posts;
  } else {
    posts = await listPosts({ ...parsed, projectId, mentions: parsed.mentions, workspaceId: authResult.bot.workspaceId });
  }
  const thread = await threadFor(posts.map((post) => post.id), authResult.bot.workspaceId);
  const [bots, humans] = await Promise.all([
    listBots(authResult.bot.workspaceId),
    listHumans(authResult.bot.workspaceId)
  ]);
  const withThread = posts.map((post) => ({
    ...post,
    comments: thread.comments[post.id] || [],
    reactionCounts: countReactionRows(post.reactions, thread.reactions[post.id] || []),
    reactionNames: namesForReactions(thread.reactions[post.id] || [], { bots, humans })
  }));
  const mentioned = exposeMentions(
    withThread,
    await listMentionIndex(withThread.map((post) => post.id), authResult.bot.workspaceId)
  );
  if (!activity) return Response.json({ posts: mentioned });
  return Response.json({ posts: mentioned, cursor: activity.cursor, nextCursor: activity.nextCursor });
}

export async function POST(request) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Post body must be a JSON object." }, { status: 400 });
  }
  const slugs = await botSlugs(authResult.bot.workspaceId);
  slugs.add(authResult.bot.slug);
  const result = validateApiPost(body, {
    from: authResult.bot.slug,
    createdAt: utcStamp(),
    slugs
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const projectSlug = typeof body.project === "string" ? body.project.trim() : "";
  let projectId = null;
  if (projectSlug) {
    const project = await projectBySlug(projectSlug, authResult.bot.workspaceId);
    if (!project || project.archived) {
      return Response.json({ error: "That project is not open." }, { status: 400 });
    }
    projectId = project.id;
  }
  try {
    const post = await insertPost({ ...result.post, projectId, workspaceId: authResult.bot.workspaceId });
    const mentions = await rememberMentions("post", post.id, post.text, { botSlug: authResult.bot.slug }, authResult.bot.workspaceId);
    return Response.json({ post: { ...post, mentions }, warnings: result.warnings }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    const message = status === 409 ? error.message : "The post could not be saved.";
    return Response.json({ error: message }, { status });
  }
}
