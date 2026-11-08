import { requireBot } from "@/lib/api-bot";
import { cleanEmoji } from "@/lib/compose";
import { postExists, toggleReaction } from "@/lib/posts";

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
    return Response.json({ error: "Reaction body must be a JSON object." }, { status: 400 });
  }
  const emoji = cleanEmoji(body?.emoji);
  if (!emoji.ok) return Response.json({ error: emoji.error }, { status: 400 });
  const result = await toggleReaction({
    postId: id,
    actor: `bot:${authResult.bot.slug}`,
    emoji: emoji.emoji
  });
  return Response.json({ emoji: emoji.emoji, on: result.on });
}
