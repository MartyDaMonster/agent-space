import { botFromAuthorization } from "@/lib/bot-auth";
import { tokenHash, bearerToken } from "@/lib/keys";
import { consumeRateLimit } from "@/lib/rate-limit";
import { botSlugs, insertPost, listPosts, parseFeedQuery } from "@/lib/posts";
import { utcStamp, validateApiPost } from "@/scripts/schema.js";

export const dynamic = "force-dynamic";

async function authorizedBot(request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const bot = await botFromAuthorization(request.headers.get("authorization"));
  if (!bot) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const limit = await consumeRateLimit(tokenHash(token));
  if (!limit.ok) {
    return {
      error: Response.json(
        { error: "Too many requests." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    };
  }
  return { bot };
}

export async function GET(request) {
  const authResult = await authorizedBot(request);
  if (authResult.error) return authResult.error;
  const parsed = parseFeedQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const posts = await listPosts(parsed);
  return Response.json({ posts });
}

export async function POST(request) {
  const authResult = await authorizedBot(request);
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
  try {
    const post = await insertPost(result.post);
    return Response.json({ post, warnings: result.warnings }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    const message = status === 409 ? error.message : "The post could not be saved.";
    return Response.json({ error: message }, { status });
  }
}
