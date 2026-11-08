"use client";

import { usePathname } from "next/navigation";

export function PageFade({ children }) {
  const pathname = usePathname() || "/";
  return <div key={pathname} className="page-fade">{children}</div>;
}
