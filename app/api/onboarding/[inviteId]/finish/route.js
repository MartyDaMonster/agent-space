import { auth } from "@/auth";
import { finishOnboardingDraft } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { inviteId } = await params;
  const session = await auth();
  const done = await finishOnboardingDraft(inviteId, session);
  if (!done.ok) return Response.json({ error: done.error }, { status: done.status });
  return Response.json({
    workspaceId: done.workspaceId,
    sourceWorkspaceId: done.sourceWorkspaceId
  });
}
