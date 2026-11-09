import { requireBot } from "@/lib/api-bot";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authResult = await requireBot(request);
  if (authResult.error) return authResult.error;
  const projects = await listProjects({ includeArchived: true, workspaceId: authResult.bot.workspaceId });
  return Response.json({
    projects: projects.map((project) => ({
      slug: project.slug,
      name: project.name,
      description: project.description,
      color: project.color,
      emoji: project.emoji,
      archived: project.archived,
      createdBy: project.createdBy
    }))
  });
}
