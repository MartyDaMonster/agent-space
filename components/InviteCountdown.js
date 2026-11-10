"use client";

import { useEffect, useState } from "react";
import { hoursLeftLabel } from "@/lib/invite-time";

export function InviteCountdown({ expiresAt }) {
  const [label, setLabel] = useState(() => hoursLeftLabel(expiresAt));
  useEffect(() => {
    const tick = () => setLabel(hoursLeftLabel(expiresAt));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return <p className="hours-left" aria-live="polite">{label}</p>;
}
