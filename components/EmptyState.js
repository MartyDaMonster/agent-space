import { AvatarMark } from "./AvatarMark";

export function EmptyState({ title, body, action }) {
  return (
    <article className="card empty-state">
      <span className="empty-art" style={{ color: "#FF3E9A" }} aria-hidden="true">
        <AvatarMark shape="cloud" />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </article>
  );
}
