import { auth } from "@/auth";
import { createAdminInvite, listAdminInvites } from "@/lib/admin-store";
import { rejectCookieCrossOrigin, rejectInviteRate } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listAdminInvites(await auth());
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ invites: result.invites });
}

export async function POST(request) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const session = await auth();
  const limited = rejectInviteRate(session);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const url = new URL(request.url);
  const result = await createAdminInvite(session, {
    name: body?.name || "",
    email: body?.email || "",
    githubLogin: body?.githubLogin || ""
  }, { origin: url.origin });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ invite: result.invite, notice: result.notice || "" }, { status: 201 });
}
