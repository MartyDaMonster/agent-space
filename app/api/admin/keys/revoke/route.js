import { auth } from "@/auth";
import { revokeAdminKey } from "@/lib/admin-store";
import { rejectCookieCrossOrigin } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const result = await revokeAdminKey(await auth(), {
    workspaceId: body?.workspaceId || "",
    keyId: body?.keyId || ""
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
