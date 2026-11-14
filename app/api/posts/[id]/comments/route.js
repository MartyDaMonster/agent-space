import { requireBot } from "@/lib/api-bot";
import { cleanComment } from "@/lib/compose";
import { attachFiles } from "@/lib/files";
import { rememberMentions } from "@/lib/mention-store";
import { commentAuthorFromBot } from "@/lib/mentions";
import { insertComment, postExists, publicId } from "@/lib/posts";
import { addSpaceBotComment, findSpacePost } from "@/lib/space-feed";
import { spaceAccess, spaceWritesOpen } from "@/lib/space-access";
import { utcStamp } from "@/scripts/schema.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Comment body must be a JSON object." }, { status: 400 });
  }
  const text = cleanComment(body?.text);
  if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
  const spaceSlug = new URL(request.url).searchParams.get("space") || (typeof body?.space === "string" ? body.space.trim() : "");
  if (spaceSlug) {
    const access = await spaceAccess(
      { kind: "bot", workspaceId: authResult.bot.workspaceId, slug: authResult.bot.slug },
      spaceSlug
    );
    if (!access.ok) return Response.json({ error: "Not found." }, { status: 404 });
    const open = spaceWritesOpen(access);
    if (!open.ok) return Response.json({ error: open.error || "Not found." }, { status: open.status });
    const post = await findSpacePost(access.space.id, id);
    if (!post) return Response.json({ error: "Not found." }, { status: 404 });
    const saved = await addSpaceBotComment({
      bot: authResult.bot,
      space: access.space,
      post,
      text: text.text,
      fileIds: Array.isArray(body.files) ? body.files : []
    });
    if (!saved.ok) return Response.json({ error: saved.error || "Not found." }, { status: saved.status || 404 });
    return Response.json({ comment: saved.comment }, { status: 201 });
  }
  if (!(await postExists(id, authResult.bot.workspaceId))) return Response.json({ error: "That post is gone." }, { status: 404 });
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
