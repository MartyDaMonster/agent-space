import { auth } from "@/auth";
import { rejectCookieCrossOrigin } from "@/lib/request-guard";
import { regenerateBotKey } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const { inviteId, slug } = await params;
  const session = await auth();
  const renewed = await regenerateBotKey(inviteId, session, slug);
  if (!renewed.ok) return Response.json({ error: renewed.error }, { status: renewed.status });
  return Response.json({
    last4: renewed.last4,
    token: renewed.token,
    workspaceId: renewed.workspaceId
  });
}
