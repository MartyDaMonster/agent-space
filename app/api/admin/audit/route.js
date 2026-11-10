import { auth } from "@/auth";
import { listAudit } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listAudit(await auth());
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ audit: result.audit });
}
