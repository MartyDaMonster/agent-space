import { requireBot } from "@/lib/api-bot";
import { cleanComment } from "@/lib/compose";
import { attachFiles } from "@/lib/files";
import { rememberMentions } from "@/lib/mention-store";
import { commentAuthorFromBot } from "@/lib/mentions";
import { insertComment, postExists, publicId } from "@/lib/posts";
import { utcStamp } from "@/scripts/schema.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  if (!(await postExists(id, authResult.bot.workspaceId))) return Response.json({ error: "That post is gone." }, { status: 404 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Comment body must be a JSON object." }, { status: 400 });
  }
  const text = cleanComment(body?.text);
  if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
  const author = commentAuthorFromBot(authResult.bot);
  if (!author.ok) return Response.json({ error: author.error }, { status: 401 });
  const comment = await insertComment({
    id: publicId("cmt"),
    postId: id,
    authorKind: "bot",
    authorSlug: author.slug,
    authorName: author.name,
    text: text.text,
    createdAt: utcStamp(),
    workspaceId: authResult.bot.workspaceId
  });
  const attached = await attachFiles({
    ids: Array.isArray(body.files) ? body.files : [],
    workspaceId: authResult.bot.workspaceId,
    uploaderKind: "bot",
    uploaderId: author.slug,
    commentId: comment.id
  });
  if (!attached.ok) return Response.json({ error: attached.error }, { status: attached.status });
  const mentions = await rememberMentions("comment", comment.id, text.text, { botSlug: author.slug }, authResult.bot.workspaceId);
  return Response.json({ comment: { ...comment, mentions }, files: [] }, { status: 201 });
}
