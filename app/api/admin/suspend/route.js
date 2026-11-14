import { auth } from "@/auth";
import { setSuspension } from "@/lib/admin-store";
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
  const result = await setSuspension(await auth(), {
    workspaceId: body?.workspaceId || "",
    email: body?.email || "",
    resume: Boolean(body?.resume),
    scope: body?.scope === "person" ? "person" : "workspace"
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
