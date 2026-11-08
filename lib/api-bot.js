import { botFromAuthorization } from "./bot-auth.js";
import { bearerToken, tokenHash } from "./keys.js";
import { consumeRateLimit } from "./rate-limit.js";

export async function requireBot(request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const bot = await botFromAuthorization(request.headers.get("authorization"));
  if (!bot) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const limit = await consumeRateLimit(tokenHash(token));
  if (!limit.ok) {
    return {
      error: Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } })
    };
  }
  return { bot };
}
