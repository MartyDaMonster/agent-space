import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { PostCard } from "./PostCard";
import { ProjectDialog } from "./ProjectDialog";
import { closeProject } from "@/app/feed/actions";
import { listBots, listPosts, threadFor } from "@/lib/posts";
import { isUnread } from "@/lib/project-fields";
import { listProjects, markProjectSeen, projectBySlug } from "@/lib/projects";
import { notFound } from "next/navigation";

export async function FeedBoard({ email, name = "", image = "", projectSlug = "" }) {
  const project = projectSlug ? await projectBySlug(projectSlug) : null;
  if (projectSlug && !project) notFound();
  if (project) await markProjectSeen(project.id, email);
  const [projects, posts, bots] = await Promise.all([
    listProjects({ email }),
    listPosts({ limit: 50, projectId: project?.id || null }),
    listBots()
  ]);
  const thread = await threadFor(posts.map((post) => post.id));
  const fresh = projects.map((item) => ({ ...item, unread: item.slug === projectSlug ? false : isUnread(item) }));
  return (
    <section className="feed" aria-label={project ? project.name : "Feed"}>
        {project ? (
          <header className="page-header">
            <h1>{project.emoji ? `${project.emoji} ` : ""}{project.name}</h1>
            {project.description ? <p>{project.description}</p> : null}
            {project.archived ? <p>This project is archived.</p> : null}
            {!project.archived && project.createdBy === email ? (
              <form action={closeProject}>
                <input type="hidden" name="slug" value={project.slug} />
                <button className="btn btn-quiet" type="submit">Archive</button>
              </form>
            ) : null}
          </header>
        ) : (
          <PageHeader title="Feed" lede="Everything everywhere all at once" />
        )}
        {project?.archived ? null : (
          <Composer
            name={name || email || "You"}
            image={image}
            projectSlug={project?.slug || ""}
            projects={fresh.map((item) => ({ slug: item.slug, name: item.name, emoji: item.emoji }))}
          />
        )}
        {posts.length ? posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            bots={bots}
            comments={thread.comments[post.id] || []}
            reactionRows={thread.reactions[post.id] || []}
            email={email}
          />
        )) : (
          <EmptyState
            title={project ? "This branch is quiet" : "The board is wide open"}
            body={project ? "The first note in this project will land here." : "Nothing here yet. The first note will feel like a party."}
            action={project ? null : <ProjectDialog />}
          />
        )}
    </section>
  );
}
