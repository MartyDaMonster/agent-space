import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { PostCard } from "./PostCard";
import { PostShell } from "./PostShell";
import { ProjectDialog } from "./ProjectDialog";
import { RenameProject } from "./RenameProject";
import { closeProject } from "@/app/feed/actions";
import { canEditPost, canManageContent } from "@/lib/moderation";
import { listHumans } from "@/lib/humans";
import { mentionDirectory } from "@/lib/mentions";
import { listBots, listPosts, sweepExpiredDeletes, threadFor } from "@/lib/posts";
import { countReactionRows, namesForReactions } from "@/lib/reactions";
import { isUnread } from "@/lib/project-fields";
import { filesForPosts } from "@/lib/files";
import { quietFeedCopy } from "@/lib/stage2";
import { workspaceTitle } from "@/lib/stage2-store";
import { FirstTask } from "./FirstTask";
import { listProjects, markProjectSeen, projectBySlug } from "@/lib/projects";
import { notFound } from "next/navigation";

export async function FeedBoard({ email, name = "", image = "", projectSlug = "", workspaceId = "" }) {
  const project = projectSlug ? await projectBySlug(projectSlug, workspaceId) : null;
  if (projectSlug && !project) notFound();
  if (project) await markProjectSeen(project.id, email, workspaceId);
  await sweepExpiredDeletes(workspaceId);
  const [projects, posts, bots, humans] = await Promise.all([
    listProjects({ email, workspaceId }),
    listPosts({ limit: 50, projectId: project?.id || null, workspaceId }),
    listBots(workspaceId),
    listHumans(workspaceId)
  ]);
  const people = mentionDirectory(bots, humans).map(({ slug, name, kind }) => ({ slug, name, kind }));
  const thread = await threadFor(posts.map((post) => post.id), workspaceId);
  const grouped = await filesForPosts(
    posts.map((post) => post.id),
    workspaceId,
    { kind: "human", id: String(email || "").toLowerCase() }
  );
  const withFiles = posts.map((post) => ({ ...post, files: grouped.posts[post.id] || [] }));
  const commentFiles = grouped.comments;
  const fresh = projects.map((item) => ({ ...item, unread: item.slug === projectSlug ? false : isUnread(item) }));
  const quiet = !project && !withFiles.length
    ? quietFeedCopy(await workspaceTitle(workspaceId), bots.map((bot) => bot.name))
    : null;
  return (
    <section className="feed" aria-label={project ? project.name : "Feed"}>
        {project ? (
          <header className="page-header">
            <h1>{project.emoji ? `${project.emoji} ` : ""}{project.name}</h1>
            {project.description ? <p>{project.description}</p> : null}
            {project.archived ? <p>This project is archived.</p> : null}
            <div className="project-actions">
              <RenameProject slug={project.slug} name={project.name} />
            </div>
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
          people={people}
        />
        {withFiles.length ? withFiles.map((post) => (
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
            people={people}
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
              comments={(thread.comments[post.id] || []).map((comment) => ({
                ...comment,
                files: commentFiles[comment.id] || []
              }))}
              reactionNames={namesForReactions(thread.reactions[post.id] || [], { bots, humans })}
              reactionCounts={countReactionRows(post.reactions, thread.reactions[post.id] || [])}
              mine={(thread.reactions[post.id] || []).filter((row) => row.actor === `human:${email}`).map((row) => row.emoji)}
              email={email}
              people={people}
            />
          </PostShell>
        )) : project ? (
          <EmptyState
            title="This branch is quiet"
            body="The first note in this project will land here."
          />
        ) : (
          <>
            {quiet?.nudge ? <FirstTask label={quiet.nudge} /> : null}
            <EmptyState title={quiet.title} body={quiet.body} />
          </>
        )}
    </section>
  );
}
