import { expireOldFiles } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET || "";
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await expireOldFiles();
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
