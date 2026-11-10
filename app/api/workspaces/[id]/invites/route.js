import { auth } from "@/auth";
import { newInviteId } from "@/lib/ids";
import { sessionInvited } from "@/lib/access";
import { insertInvite, listInvites } from "@/lib/invites";
import { authorizeInviteCreate } from "@/lib/workspace";
import { workspaceRole } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

async function ownerSession(workspaceId) {
  const session = await auth();
  if (!sessionInvited(session)) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = await workspaceRole(session, workspaceId);
  const allowed = authorizeInviteCreate({ actorWorkspace: workspaceId, actorRole: role, workspaceId });
  if (!allowed.ok) return { error: Response.json({ error: "Forbidden" }, { status: allowed.status }) };
  return { session };
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const actor = await ownerSession(id);
  if (actor.error) return actor.error;
  const invites = await listInvites(id);
  return Response.json({ invites });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const actor = await ownerSession(id);
  if (actor.error) return actor.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const created = await insertInvite({
    id: newInviteId(),
    workspaceId: id,
    email: body?.email || "",
    githubLogin: body?.githubLogin || "",
    createdBy: actor.session.user?.email || actor.session.user?.githubLogin || "owner"
  });
  if (!created.ok) return Response.json({ error: created.error }, { status: 400 });
  return Response.json({ invite: created.invite }, { status: 201 });
}
