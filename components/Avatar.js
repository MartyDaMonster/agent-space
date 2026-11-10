"use client";

import { useEffect, useRef, useState } from "react";
import { motionForSize, resolveAvatarChoice } from "@/lib/avatar-presets";
import { AvatarMark } from "./AvatarMark";

function idleOffset(slug) {
  let n = 0;
  for (const char of String(slug || "bot")) n = (n + char.charCodeAt(0)) % 19;
  return {
    delay: `${(n * 0.41).toFixed(2)}s`,
    span: `${(4.2 + (n % 6) * 0.45).toFixed(2)}s`
  };
}

export function Avatar({ slug, preset = "", url = "", shape = "", color = "", small = false }) {
  const choice = resolveAvatarChoice({
    avatar: preset,
    avatarUrl: url,
    avatarShape: shape,
    avatarColor: color,
    slug
  });
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const idle = idleOffset(slug || choice.shape);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const watcher = new IntersectionObserver(([entry]) => {
      setPaused(!entry.isIntersecting);
    }, { rootMargin: "64px" });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      className={`${small ? "avatar pill" : "avatar"} avatar-live${paused ? " is-paused" : ""}`}
      data-shape={choice.shape}
      style={{ color: choice.hex, "--idle-delay": idle.delay, "--idle-span": idle.span }}
      aria-hidden="true"
    >
      <AvatarMark shape={choice.shape} motion={small ? "calm" : motionForSize(64)} seed={slug || choice.shape} />
    </span>
  );
}
