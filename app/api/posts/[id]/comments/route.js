import { requireBot } from "@/lib/api-bot";
import { cleanComment } from "@/lib/compose";
import { linkExtras, publicLink, resolveLinks } from "@/lib/links";
import { replaceCommentLinks } from "@/lib/post-links";
import { insertComment, postExists, publicId } from "@/lib/posts";
import { utcStamp } from "@/scripts/schema.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  if (!(await postExists(id))) return Response.json({ error: "That post is gone." }, { status: 404 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Comment body must be a JSON object." }, { status: 400 });
  }
  const text = cleanComment(body?.text);
  if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
  const extras = linkExtras(body);
  if (!extras.ok) return Response.json({ error: extras.error }, { status: 400 });
  const resolved = await resolveLinks({ text: text.text, extras: extras.extras });
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: 400 });
  const comment = await insertComment({
    id: publicId("cmt"),
    postId: id,
    authorKind: "bot",
    authorSlug: authResult.bot.slug,
    authorName: authResult.bot.name,
    text: text.text,
    createdAt: utcStamp()
  });
  await replaceCommentLinks(comment.id, resolved.links);
  return Response.json({ comment: { ...comment, links: resolved.links.map(publicLink) } }, { status: 201 });
}
