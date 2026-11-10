"use client";

import { useEffect, useState } from "react";
import { remainingParts } from "@/lib/invite-time";

export function InviteCountdown({ expiresAt }) {
  const [parts, setParts] = useState(() => remainingParts(expiresAt));
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return undefined;
    const timer = setInterval(() => setParts(remainingParts(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const tiles = parts.expired
    ? [["--", "Hours"], ["--", "Minutes"], ["--", "Seconds"]]
    : [[parts.hours, "Hours"], [parts.minutes, "Minutes"], [parts.seconds, "Seconds"]];
  return (
    <div className="clock" aria-live="polite">
      {tiles.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
      {parts.expired ? <p className="clock-expired">Expired</p> : null}
    </div>
  );
}
