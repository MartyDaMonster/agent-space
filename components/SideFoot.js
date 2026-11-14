import { createElement } from "react";
import { sidebarLinks } from "../lib/admin-panel.js";

function current(pathname, link, showAdmin) {
  if (link.href === "/admin") {
    const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    if (!onAdmin) return false;
    return link.label === "Admin" || !showAdmin;
  }
  if (link.href === "/") return pathname === "/";
  if (link.href === "/projects") return pathname === "/projects" || pathname.startsWith("/p/");
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
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
        className: "side-link",
        "aria-current": current(pathname, link, showAdmin) ? "page" : undefined,
        ...(link.label === "Invite a bot" ? { "data-add-bot": "primary" } : {})
      },
      link.label
    ))
  );
}
