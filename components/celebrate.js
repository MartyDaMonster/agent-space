"use client";

import { useEffect } from "react";

export async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 90,
    spread: 68,
    startVelocity: 32,
    ticks: 160,
    origin: { y: 0.72 },
    colors: ["#c6ff3d", "#ff3e9a", "#2be3ff", "#8a5cff", "#ffe14a"]
  });
}

export function CelebrateOnce({ kind = "" }) {
  useEffect(() => {
    if (kind !== "project" && kind !== "post") return;
    celebrate();
    const url = new URL(window.location.href);
    if (!url.searchParams.has("celebrate")) return;
    url.searchParams.delete("celebrate");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, [kind]);
  return null;
}
