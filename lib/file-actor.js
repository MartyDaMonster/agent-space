import { auth } from "@/auth";
import { requireBot } from "./api-bot.js";
import { emailAllowed } from "./access.js";
import { bearerToken } from "./keys.js";

export async function requireFileActor(request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (token) {
    const bot = await requireBot(request);
    if (bot.error) return bot;
    return { owner: { kind: "bot", id: bot.bot.slug } };
  }
  const session = await auth();
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!emailAllowed(email, process.env.ALLOWED_EMAILS)) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { owner: { kind: "human", id: email } };
}
