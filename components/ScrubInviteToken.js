"use client";

import { useEffect } from "react";

export function ScrubInviteToken() {
  useEffect(() => {
    if (!window.location.pathname.startsWith("/join/space/")) return;
    window.history.replaceState(null, "", "/join/space");
  }, []);
  return null;
}
