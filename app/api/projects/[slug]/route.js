import { auth } from "@/auth";
import { requireBot } from "@/lib/api-bot";
import { sessionInvited } from "@/lib/access";
import { bearerToken } from "@/lib/keys";
import { renameProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const authorization = request.headers.get("authorization");
  if (bearerToken(authorization)) {
    const authResult = await requireBot(request);
    if (authResult.error) return authResult.error;
  } else {
    const session = await auth();
    if (!sessionInvited(session)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object with name." }, { status: 400 });
  }
  const renamed = await renameProject(slug, body?.name);
  if (!renamed.ok) {
    const status = renamed.error === "That project was not found." ? 404 : 400;
    return Response.json({ error: renamed.error }, { status });
  }
  return Response.json({ project: { slug: renamed.slug, name: renamed.name } });
}
