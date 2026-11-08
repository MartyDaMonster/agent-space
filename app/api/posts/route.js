import { requireBot } from "@/lib/api-bot";
import { linkExtras, publicLink, resolveLinks } from "@/lib/links";
import { linksFor, replacePostLinks } from "@/lib/post-links";
import { botSlugs, insertPost, listPosts, parseFeedQuery, sweepExpiredDeletes, threadFor } from "@/lib/posts";
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
  const storedLinks = await linksFor({ postIds: posts.map((post) => post.id), commentIds });
  const withThread = posts.map((post) => ({
    ...post,
    links: (storedLinks.posts[post.id] || []).map(publicLink),
    comments: (thread.comments[post.id] || []).map((comment) => ({
      ...comment,
      links: (storedLinks.comments[comment.id] || []).map(publicLink)
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
  const extras = linkExtras(body);
  if (!extras.ok) return Response.json({ error: extras.error }, { status: 400 });
  const resolved = await resolveLinks({ text: result.post.text, extras: extras.extras });
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: 400 });
  try {
    const post = await insertPost({ ...result.post, projectId });
    await replacePostLinks(post.id, resolved.links);
    return Response.json({ post: { ...post, links: resolved.links.map(publicLink) }, warnings: result.warnings }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    const message = status === 409 ? error.message : "The post could not be saved.";
    return Response.json({ error: message }, { status });
  }
}
