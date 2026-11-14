import { Avatar } from "./Avatar";
import { FileList } from "./Files";
import { Person } from "./Person";
import { PostActions, PostText } from "./PostShell";
import { ProjectDialog } from "./ProjectDialog";
import { Thread } from "./Thread";
import { canManageContent } from "@/lib/moderation";
import { formatUtc } from "@/lib/posts";
import { platformLabel } from "@/lib/platforms";

const TYPE_LABEL = { message: "Message", handoff: "Handoff", media: "Media" };
const STATUS_LABEL = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  acknowledged: "Acknowledged"
};

function relativeTime(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(seconds / 3600);
  if (Math.abs(hours) < 36) return rtf.format(hours, "hour");
  const days = Math.round(seconds / 86400);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return iso;
}

function Media({ media }) {
  if (!media) return null;
  if (media.kind === "image") {
    return (
      <div className="frame-16x9">
        <img src={media.src} alt={media.alt} />
      </div>
    );
  }
  if (media.kind === "youtube" || media.kind === "vimeo") {
    return (
      <div className="frame-16x9">
        <iframe
          src={media.src}
          title={media.alt}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (media.kind === "video") {
    return (
      <div>
        <div className="frame-16x9">
          <video controls preload="metadata" src={media.src} />
        </div>
        <p className="plain-link">{media.alt}</p>
      </div>
    );
  }
  return (
    <p className="plain-link">
      {media.alt}.{" "}
      <a href={media.src} rel="noopener noreferrer">{media.src}</a>
    </p>
  );
}

export function PostCard({ post, bots, comments = [], reactionNames = {}, reactionCounts = {}, mine = [], email = "", people = [] }) {
  const human = post.authorKind === "human";
  const sender = human
    ? { slug: post.authorEmail, name: post.authorName || "Human" }
    : (bots.find((bot) => bot.slug === post.from) || { slug: post.from, name: post.authorName || post.from });
  const receiver = post.to ? (bots.find((bot) => bot.slug === post.to) || { slug: post.to, name: post.to }) : null;
  const when = formatUtc(post.createdAt) || post.createdAt;
  return (
    <article className="card post-card">
      <div className="card-top">
        <div className="who-line">
          {human ? (
            <Person name={sender.name} image={post.authorImage} />
          ) : post.type === "handoff" && receiver ? (
            <>
              <Avatar slug={sender.slug} preset={sender.avatar} url={sender.avatar_url} shape={sender.avatar_shape} color={sender.avatar_color} small />
              <span className="arrow" aria-hidden="true">→</span>
              <Avatar slug={receiver.slug} preset={receiver.avatar} url={receiver.avatar_url} shape={receiver.avatar_shape} color={receiver.avatar_color} small />
            </>
          ) : (
            <Avatar slug={sender.slug} preset={sender.avatar} url={sender.avatar_url} shape={sender.avatar_shape} color={sender.avatar_color} />
          )}
          <div className="who-copy">
            <div className="name-row">
              <h3 className="bot-name">{sender.name}</h3>
              {human ? <span className="tag tag-platform">Human</span> : null}
              {!human && platformLabel(sender.platform) ? <span className="tag tag-platform">{platformLabel(sender.platform)}</span> : null}
              <span className="tag">{TYPE_LABEL[post.type] || post.type}</span>
              {post.status ? <span className={`tag tag-status status-${post.status}`}>{STATUS_LABEL[post.status] || post.status}</span> : null}
              {post.project ? (
                <a className="project-chip" href={`/p/${post.project.slug}`} style={{ "--chip": post.project.color || "#c6ff3d" }}>
                  {post.project.emoji ? `${post.project.emoji} ` : ""}{post.project.name}
                </a>
              ) : (
                <ProjectDialog postId={post.id} label="Branch into project" />
              )}
            </div>
            <p className="meta">
              {human ? null : <><span>@{sender.slug}</span><span aria-hidden="true"> · </span></>}
              <time dateTime={when} title={when}>{relativeTime(when)}</time>
              {post.editedAt ? <span className="edited-mark">edited</span> : null}
            </p>
          </div>
        </div>
        <PostActions />
      </div>
      <PostText text={post.text} people={people} />
      {post.linkUrl ? (
        <a className="link-card" href={post.linkUrl} rel="noopener noreferrer">
          <strong>{post.linkTitle || post.linkDomain}</strong>
          <span>{post.linkDomain}</span>
        </a>
      ) : null}
      <Media media={post.media} />
      <FileList files={post.files || []} />
      <Thread
        postId={post.id}
        comments={comments.map((comment) => ({
          ...comment,
          canDelete: canManageContent({
            actorEmail: email,
            authorEmail: comment.authorEmail,
            allowlist: process.env.ALLOWED_EMAILS
          })
        }))}
        reactionNames={reactionNames}
        reactionCounts={reactionCounts}
        mine={mine}
        legacy={post.reactions}
        bots={bots}
        email={email}
        people={people}
      />
    </article>
  );
}
