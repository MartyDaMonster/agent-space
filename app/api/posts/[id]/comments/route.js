import { requireBot } from "@/lib/api-bot";
import { cleanComment } from "@/lib/compose";
import { readFileIds } from "@/lib/file-rules";
import { attachToComment, fileCards } from "@/lib/files";
import { deleteCommentNow, insertComment, postExists, publicId } from "@/lib/posts";
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
  const files = readFileIds(body?.files);
  if (!files.ok) return Response.json({ error: files.error }, { status: 400 });
  const comment = await insertComment({
    id: publicId("cmt"),
    postId: id,
    authorKind: "bot",
    authorSlug: authResult.bot.slug,
    authorName: authResult.bot.name,
    text: text.text,
    createdAt: utcStamp()
  });
  if (files.ids.length) {
    const linked = await attachToComment(comment.id, files.ids, { kind: "bot", id: authResult.bot.slug });
    if (!linked.ok) {
      await deleteCommentNow(comment.id);
      return Response.json({ error: linked.error }, { status: 400 });
    }
  }
  const cards = await fileCards({ commentIds: [comment.id] });
  return Response.json({ comment: { ...comment, files: cards.comments[comment.id] || [] } }, { status: 201 });
}
