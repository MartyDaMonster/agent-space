import { auth } from "@/auth";
import { sessionInvited } from "@/lib/access";
import { botFromAuthorization } from "@/lib/bot-auth";
import { bearerToken, tokenHash } from "@/lib/keys";
import { dailyAccess, listMetrics, parseDays, reportWindow, summarizeDaily } from "@/lib/metrics";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = request.headers.get("authorization");
  const token = bearerToken(authorization);
  let bearerValid = false;
  if (token) {
    const bot = await botFromAuthorization(authorization);
    bearerValid = Boolean(bot);
    if (bearerValid) {
      const limit = await consumeRateLimit(tokenHash(token));
      if (!limit.ok) {
        return Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } });
      }
    }
  }
  const session = token ? null : await auth();
  const decision = dailyAccess({ authorization, bearerValid, invited: sessionInvited(session) });
  if (!decision.ok) return Response.json({ error: "Unauthorized" }, { status: decision.status });
  const days = parseDays(request.nextUrl.searchParams.get("days"));
  if (days == null) return Response.json({ error: "days must be a whole number from 1 to 90." }, { status: 400 });
  const window = reportWindow(days);
  const events = await listMetrics(window.start, window.end);
  return Response.json(summarizeDaily(events, { days }));
}
