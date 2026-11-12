import { auth } from "@/auth";
import { revokeAdminInvite } from "@/lib/admin-store";
import { rejectCookieCrossOrigin, rejectInviteRate } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const session = await auth();
  const limited = rejectInviteRate(session);
  if (limited) return limited;
  const { inviteId } = await params;
  const result = await revokeAdminInvite(session, inviteId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
