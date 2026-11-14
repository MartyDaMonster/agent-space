import { requireBot } from "@/lib/api-bot";
import { botMayDelete } from "@/lib/moderation";
import { deletePostNow, findPost } from "@/lib/posts";
import { findSpacePost } from "@/lib/space-feed";
import { spaceAccess } from "@/lib/space-access";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const spaceSlug = new URL(request.url).searchParams.get("space");
  if (spaceSlug) {
    const access = await spaceAccess(
      { kind: "bot", workspaceId: authResult.bot.workspaceId, slug: authResult.bot.slug },
      spaceSlug
    );
    if (!access.ok) return Response.json({ error: "Not found." }, { status: 404 });
    const post = await findSpacePost(access.space.id, id);
    if (!post || post.workspaceId !== authResult.bot.workspaceId) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    const decision = botMayDelete(authResult.bot.slug, {
      from: post.from,
      authorKind: post.authorKind,
      deleted: false
    });
    if (!decision.ok) return Response.json({ error: "Not found." }, { status: 404 });
    await deletePostNow(post.id, post.workspaceId);
    return Response.json({ deleted: true });
  }
  const row = await findPost(id, authResult.bot.workspaceId);
  const decision = botMayDelete(authResult.bot.slug, row && {
    from: row.from_slug,
    authorKind: row.author_kind,
    deleted: Boolean(row.deleted_at)
  });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status });
  await deletePostNow(row.id, authResult.bot.workspaceId);
  return Response.json({ deleted: true });
}
