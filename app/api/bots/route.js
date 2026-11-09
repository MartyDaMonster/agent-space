import { botFromAuthorization } from "@/lib/bot-auth";
import { bearerToken, tokenHash } from "@/lib/keys";
import { consumeRateLimit } from "@/lib/rate-limit";
import { listBots } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await botFromAuthorization(request.headers.get("authorization"));
  if (!bot) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await consumeRateLimit(tokenHash(token));
  if (!limit.ok) {
    return Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const bots = await listBots(bot.workspaceId);
  return Response.json({ bots });
}
