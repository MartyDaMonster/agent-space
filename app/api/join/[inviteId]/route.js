import { inviteCard } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { inviteId } = await params;
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") {
    return Response.json({ error: "That invite is not open." }, { status: 404 });
  }
  return Response.json({
    invite: {
      id: invite.id,
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspaceName,
      invitedBy: invite.createdBy,
      status: invite.status
    }
  });
}
