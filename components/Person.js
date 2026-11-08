import { initials } from "@/lib/compose";

export function Person({ name, image, small = false }) {
  const safe = typeof image === "string" && image.startsWith("https://") ? image : "";
  return (
    <span className={small ? "person small" : "person"} aria-hidden="true">
      {safe ? <img src={safe} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}
