import { requireBot } from "@/lib/api-bot";
import { botMayDelete } from "@/lib/moderation";
import { deletePostNow, findPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const row = await findPost(id);
  const decision = botMayDelete(authResult.bot.slug, row && {
    from: row.from_slug,
    authorKind: row.author_kind,
    deleted: Boolean(row.deleted_at)
  });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status });
  await deletePostNow(row.id);
  return Response.json({ deleted: true });
}
