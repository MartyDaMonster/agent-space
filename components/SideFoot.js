import { createElement } from "react";
import { sidebarLinks } from "../lib/admin-panel.js";

function current(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/p/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideFoot({ pathname = "/", showAdmin = false, children = null }) {
  return createElement(
    "div",
    { className: "side-foot" },
    children,
    sidebarLinks(showAdmin).map((link) => createElement(
      "a",
      {
        key: link.label,
        href: link.href,
        "aria-current": current(pathname, link.href) ? "page" : undefined
      },
      link.label
    ))
  );
}
