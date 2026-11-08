import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { PostCard } from "./PostCard";
import { PostShell } from "./PostShell";
import { ProjectDialog } from "./ProjectDialog";
import { closeProject } from "@/app/feed/actions";
import { canEditPost, canManageContent } from "@/lib/moderation";
import { linksFor } from "@/lib/post-links";
import { listBots, listPosts, sweepExpiredDeletes, threadFor } from "@/lib/posts";
import { isUnread } from "@/lib/project-fields";
import { listProjects, markProjectSeen, projectBySlug } from "@/lib/projects";
import { notFound } from "next/navigation";

export async function FeedBoard({ email, name = "", image = "", projectSlug = "" }) {
  const project = projectSlug ? await projectBySlug(projectSlug) : null;
  if (projectSlug && !project) notFound();
  if (project) await markProjectSeen(project.id, email);
  await sweepExpiredDeletes();
  const [projects, posts, bots] = await Promise.all([
    listProjects({ email }),
    listPosts({ limit: 50, projectId: project?.id || null }),
    listBots()
  ]);
  const thread = await threadFor(posts.map((post) => post.id));
  const commentIds = Object.values(thread.comments).flat().map((comment) => comment.id);
  const storedLinks = await linksFor({ postIds: posts.map((post) => post.id), commentIds });
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
        <Composer
          name={name || email || "You"}
          image={image}
          projectSlug={project?.slug || ""}
          projects={fresh.map((item) => ({ slug: item.slug, name: item.name, emoji: item.emoji }))}
          trigger={!project?.archived}
        />
        {posts.length ? posts.map((post) => (
          <PostShell
            key={post.id}
            postId={post.id}
            text={post.text}
            canManage={canManageContent({
              actorEmail: email,
              authorEmail: post.authorEmail,
              allowlist: process.env.ALLOWED_EMAILS
            })}
            canEdit={canEditPost({
              actorEmail: email,
              authorEmail: post.authorEmail,
              authorKind: post.authorKind
            })}
            edit={{
              id: post.id,
              text: post.text,
              linkUrl: post.linkUrl,
              linkTitle: post.linkTitle,
              linkDomain: post.linkDomain,
              media: post.media || null,
              projectSlug: post.project?.slug || ""
            }}
          >
            <PostCard
              post={post}
              bots={bots}
              links={storedLinks.posts[post.id] || []}
              comments={(thread.comments[post.id] || []).map((comment) => ({
                ...comment,
                links: storedLinks.comments[comment.id] || []
              }))}
              reactionRows={thread.reactions[post.id] || []}
              email={email}
            />
          </PostShell>
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
