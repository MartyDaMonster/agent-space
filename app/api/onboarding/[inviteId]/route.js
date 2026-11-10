import { auth } from "@/auth";
import { botsForDraft, loadDraft } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { inviteId } = await params;
  const session = await auth();
  const listed = await botsForDraft(inviteId, session);
  if (!listed.ok) return Response.json({ error: listed.error }, { status: listed.status });
  const draft = await loadDraft(inviteId);
  return Response.json({
    workspaceId: listed.workspaceId,
    sourceWorkspaceId: draft?.sourceWorkspaceId || "",
    bots: listed.bots.map((bot) => ({
      slug: bot.slug,
      name: bot.name,
      connected: bot.connected,
      masked: Boolean(bot.last4)
    }))
  });
}
