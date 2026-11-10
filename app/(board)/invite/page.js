import { auth } from "@/auth";
import { InvitePeople } from "@/components/InvitePeople";
import { listInvites } from "@/lib/invites";
import { sentLabel } from "@/lib/stage2";
import { workspaceTitle } from "@/lib/stage2-store";
import { workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";
import { authorizeInviteCreate } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { revokePersonInvite, sendPersonInvite } from "./actions";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const session = await auth();
  const workspaceId = await workspaceIdForSession(session);
  const role = await workspaceRole(session, workspaceId);
  const allowed = authorizeInviteCreate({ actorWorkspace: workspaceId, actorRole: role, workspaceId });
  if (!allowed.ok) redirect("/");
  const [name, invites] = await Promise.all([
    workspaceTitle(workspaceId),
    listInvites(workspaceId)
  ]);
  return (
    <InvitePeople
      workspaceName={name}
      invites={invites.map((invite) => ({ ...invite, sent: sentLabel(invite.createdAt) }))}
      send={sendPersonInvite}
      revoke={revokePersonInvite}
    />
  );
}
