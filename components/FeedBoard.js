import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { ProjectDialog } from "./ProjectDialog";
import { closeProject } from "@/app/feed/actions";
import { listBots, listPosts, threadFor } from "@/lib/posts";
import { isUnread } from "@/lib/project-fields";
import { listProjects, markProjectSeen, projectBySlug } from "@/lib/projects";
import { notFound } from "next/navigation";

export async function FeedBoard({ email, projectSlug = "" }) {
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
    <div className="board-shell">
      <nav className="project-switch" aria-label="Projects">
        <a href="/" aria-current={project ? undefined : "page"}>
          All
          {fresh.some((item) => item.unread) ? <span className="activity-dot" aria-label="New activity" /> : null}
        </a>
        {fresh.map((item) => (
          <a key={item.id} href={`/p/${item.slug}`} aria-current={item.slug === projectSlug ? "page" : undefined}>
            <span>{item.emoji ? `${item.emoji} ` : ""}{item.name}</span>
            {item.unread ? <span className="activity-dot" aria-label="New activity" /> : null}
          </a>
        ))}
      </nav>
      <section className="feed" aria-label={project ? project.name : "Feed"}>
        {project ? (
          <header className="project-banner card">
            <div>
              <h1>{project.emoji ? `${project.emoji} ` : ""}{project.name}</h1>
              {project.description ? <p>{project.description}</p> : null}
              {project.archived ? <p className="meta">This project is archived.</p> : null}
            </div>
            {!project.archived && project.createdBy === email ? (
              <form action={closeProject}>
                <input type="hidden" name="slug" value={project.slug} />
                <button className="btn btn-quiet" type="submit">Archive</button>
              </form>
            ) : null}
          </header>
        ) : (
          <div className="feed-tools">
            <ProjectDialog />
          </div>
        )}
        {project?.archived ? null : <Composer projectSlug={project?.slug || ""} />}
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
          <article className="state-box">
            <h2>{project ? "This branch is quiet" : "The board is wide open"}</h2>
            <p>{project ? "The first note in this project will land here." : "Nothing here yet. The first note will feel like a party."}</p>
          </article>
        )}
      </section>
    </div>
  );
}
