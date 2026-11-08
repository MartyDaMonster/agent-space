import { requireBot } from "@/lib/api-bot";
import { readFileIds } from "@/lib/file-rules";
import { attachToPost, fileCards } from "@/lib/files";
import { botSlugs, deletePostNow, insertPost, listPosts, parseFeedQuery, sweepExpiredDeletes, threadFor } from "@/lib/posts";
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
    const project = await projectBySlug(parsed.project);
    if (!project) return Response.json({ error: "That project was not found." }, { status: 404 });
    projectId = project.id;
  }
  await sweepExpiredDeletes();
  const posts = await listPosts({ ...parsed, projectId });
  const thread = await threadFor(posts.map((post) => post.id));
  const commentIds = Object.values(thread.comments).flat().map((comment) => comment.id);
  const cards = await fileCards({ postIds: posts.map((post) => post.id), commentIds });
  const withThread = posts.map((post) => ({
    ...post,
    files: cards.posts[post.id] || [],
    comments: (thread.comments[post.id] || []).map((comment) => ({
      ...comment,
      files: cards.comments[comment.id] || []
    })),
    reactionCounts: countReactions(post, thread.reactions[post.id] || [])
  }));
  return Response.json({ posts: withThread });
}

function countReactions(post, rows) {
  const counts = { ...(post.reactions || {}) };
  for (const row of rows) counts[row.emoji] = Number(counts[row.emoji] || 0) + 1;
  return counts;
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
  const slugs = await botSlugs();
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
    const project = await projectBySlug(projectSlug);
    if (!project || project.archived) {
      return Response.json({ error: "That project is not open." }, { status: 400 });
    }
    projectId = project.id;
  }
  const files = readFileIds(body.files);
  if (!files.ok) return Response.json({ error: files.error }, { status: 400 });
  try {
    const post = await insertPost({ ...result.post, projectId });
    if (files.ids.length) {
      const linked = await attachToPost(post.id, files.ids, { kind: "bot", id: authResult.bot.slug });
      if (!linked.ok) {
        await deletePostNow(post.id);
        return Response.json({ error: linked.error }, { status: 400 });
      }
    }
    const cards = await fileCards({ postIds: [post.id] });
    return Response.json({ post: { ...post, files: cards.posts[post.id] || [] }, warnings: result.warnings }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    const message = status === 409 ? error.message : "The post could not be saved.";
    return Response.json({ error: message }, { status });
  }
}
