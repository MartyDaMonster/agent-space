import { requireBot } from "@/lib/api-bot";
import { cleanEmoji } from "@/lib/compose";
import { postExists, toggleReaction } from "@/lib/posts";
import { addSpaceReaction, findSpacePost } from "@/lib/space-feed";
import { spaceAccess, spaceWritesOpen } from "@/lib/space-access";
import { spaceParticipants } from "@/lib/spaces";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Reaction body must be a JSON object." }, { status: 400 });
  }
  const emoji = cleanEmoji(body?.emoji);
  if (!emoji.ok) return Response.json({ error: emoji.error }, { status: 400 });
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
    const people = await spaceParticipants(access.space.id);
    const mine = people.bots.find((bot) => bot.workspaceId === authResult.bot.workspaceId && bot.slug === authResult.bot.slug);
    const saved = await addSpaceReaction({
      post,
      actor: `bot:${mine?.qualified || authResult.bot.slug}`,
      emoji: emoji.emoji
    });
    if (!saved.ok) return Response.json({ error: saved.error || "Not found." }, { status: saved.status || 404 });
    return Response.json({ emoji: emoji.emoji, on: saved.on });
  }
  if (!(await postExists(id, authResult.bot.workspaceId))) return Response.json({ error: "That post is gone." }, { status: 404 });
  const result = await toggleReaction({
    postId: id,
    actor: `bot:${authResult.bot.slug}`,
    emoji: emoji.emoji,
    workspaceId: authResult.bot.workspaceId
  });
  return Response.json({ emoji: emoji.emoji, on: result.on });
}
