"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/bots", label: "Bots" },
  { href: "/contribute", label: "Contribute" },
  { href: "/admin", label: "Keys" }
];

function current(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SectionNav({ children }) {
  const pathname = usePathname() || "/";
  return (
    <nav className="pill-nav" aria-label="Sections">
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          aria-current={current(pathname, link.href) ? "page" : undefined}
        >
          {link.label}
        </a>
      ))}
      {children}
    </nav>
  );
}
