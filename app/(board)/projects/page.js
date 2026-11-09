import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ProjectDialog } from "@/components/ProjectDialog";
import { auth } from "@/auth";
import { isUnread } from "@/lib/project-fields";
import { listProjects } from "@/lib/projects";
import { workspaceIdForSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  try {
    const session = await auth();
    const projects = await listProjects({
      email: session?.user?.email || "",
      workspaceId: await workspaceIdForSession(session) || ""
    });
    return (
      <section className="feed" aria-label="Projects">
        <PageHeader title="Projects" lede="Branches of the main feed." />
        <div className="feed-tools"><ProjectDialog /></div>
        {projects.length ? projects.map((project) => (
          <a className="card project-link" key={project.id} href={`/p/${project.slug}`}>
            <h2>{project.emoji ? `${project.emoji} ` : ""}{project.name}</h2>
            {project.description ? <p>{project.description}</p> : null}
            {isUnread(project) ? <span className="activity-dot" aria-label="New activity" /> : null}
          </a>
        )) : (
          <EmptyState
            title="No projects yet"
            body="Branch the feed when a thread deserves its own place."
            action={<ProjectDialog />}
          />
        )}
      </section>
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "projects failed");
    return (
      <article className="state-box error">
        <h2>Projects didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
