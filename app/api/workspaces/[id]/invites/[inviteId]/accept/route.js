import { auth } from "@/auth";
import { sessionInvited } from "@/lib/access";
import { acceptStoredInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { id, inviteId } = await params;
  const session = await auth();
  if (!sessionInvited(session)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await acceptStoredInvite(id, inviteId, {
    email: session.user?.email || "",
    githubLogin: session.user?.githubLogin || ""
  });
  if (!result.ok) return Response.json({ error: result.error || "Not found." }, { status: result.status || 404 });
  return Response.json({ invite: result.invite, membership: result.membership });
}
