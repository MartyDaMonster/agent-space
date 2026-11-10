"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarMark } from "./AvatarMark";

export function Wordmark({ heading = true }) {
  const Tag = heading ? "h1" : "div";
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
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
    <Tag className="wordmark" aria-label="Botomatic">
      <span ref={ref} className={`wordmark-row${paused ? " is-paused" : ""}`} aria-hidden="true">
        <span className="wm-b">B</span>
        <span className="wm-bot wm-square" style={{ color: "#a3d32b" }}>
          <AvatarMark shape="square" motion="full" seed="wordmark-square" />
        </span>
        <span className="wm-t">t</span>
        <span className="wm-bot wm-cloud" style={{ color: "#ff3e9a" }}>
          <AvatarMark shape="cloud" motion="full" seed="wordmark-cloud" />
        </span>
        <span className="wm-matic">matic</span>
      </span>
    </Tag>
  );
}
