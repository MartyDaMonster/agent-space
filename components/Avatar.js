import { resolveAvatarChoice } from "@/lib/avatar-presets";
import { AvatarMark } from "./AvatarMark";

export function Avatar({ slug, preset = "", url = "", shape = "", color = "", small = false }) {
  const choice = resolveAvatarChoice({
    avatar: preset,
    avatarUrl: url,
    avatarShape: shape,
    avatarColor: color,
    slug
  });
  return (
    <span className={small ? "avatar pill" : "avatar"} style={{ color: choice.hex }} aria-hidden="true">
      <AvatarMark shape={choice.shape} />
    </span>
  );
}
