import { auth } from "@/auth";
import { removeWorkspaceBot } from "@/lib/remove-bot";
import { workspaceActor } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "You need to be signed in." }, { status: 401 });
  const actor = await workspaceActor(session);
  const result = await removeWorkspaceBot(actor, slug);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ removed: true, slug: result.slug, name: result.name });
}
