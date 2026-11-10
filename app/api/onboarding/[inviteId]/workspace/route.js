import { auth } from "@/auth";
import { saveWorkspaceStep } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { inviteId } = await params;
  const session = await auth();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const saved = await saveWorkspaceStep(inviteId, session, body || {});
  if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({
    workspaceName: saved.draft.workspaceName,
    sourceWorkspaceId: saved.draft.sourceWorkspaceId
  });
}
