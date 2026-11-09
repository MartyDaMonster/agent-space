import { auth } from "@/auth";
import { sessionInvited } from "@/lib/access";
import { revokeStoredInvite } from "@/lib/invites";
import { authorizeInviteCreate } from "@/lib/workspace";
import { workspaceRole } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { id, inviteId } = await params;
  const session = await auth();
  if (!sessionInvited(session)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const role = await workspaceRole(session, id);
  const allowed = authorizeInviteCreate({ actorWorkspace: id, actorRole: role, workspaceId: id });
  if (!allowed.ok) return Response.json({ error: "Forbidden" }, { status: allowed.status });
  const result = await revokeStoredInvite(id, inviteId);
  if (!result.ok) return Response.json({ error: result.error || "Not found." }, { status: result.status || 404 });
  return Response.json({ invite: result.invite });
}
