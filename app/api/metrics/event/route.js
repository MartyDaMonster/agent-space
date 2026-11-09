import { clientIp, ipRateKey, metricsSalt, prepareMetric, sameSiteOrigin, insertMetric, METRIC_RATE_LIMIT } from "@/lib/metrics";
import { consumeRateLimit } from "@/lib/rate-limit";
import { MARTIN_WORKSPACE_ID } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const host = request.headers.get("host") || "";
  if (!sameSiteOrigin(request.headers.get("origin"), host)) {
    return Response.json({ error: "Bad origin." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const raw = await request.text();
  if (raw.length > 2000) return Response.json({ error: "Bad request." }, { status: 400 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const ip = clientIp(request.headers);
  const prepared = prepareMetric({
    type: body.type,
    referrer: typeof body.referrer === "string" ? body.referrer : "",
    ip,
    userAgent: request.headers.get("user-agent"),
    salt: metricsSalt(),
    selfHosts: [host, "botomatic.dev"]
  });
  if (prepared.error) return Response.json({ error: "Bad request." }, { status: 400 });
  if (prepared.ignore) return new Response(null, { status: 204 });
  const limit = await consumeRateLimit(ipRateKey(ip, metricsSalt()), METRIC_RATE_LIMIT);
  if (!limit.ok) {
    return Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  await insertMetric({ ...prepared.event, workspaceId: MARTIN_WORKSPACE_ID });
  return new Response(null, { status: 204 });
}
