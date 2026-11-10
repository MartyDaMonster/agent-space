import { auth } from "@/auth";
import { resendAdminInvite } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { inviteId } = await params;
  const result = await resendAdminInvite(await auth(), inviteId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
