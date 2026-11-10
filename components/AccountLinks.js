import { createElement } from "react";

function onAdmin(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function AccountLinks({ showAdmin = false, pathname = "/" }) {
  return createElement(
    "div",
    { className: "account-links" },
    showAdmin
      ? createElement(
        "a",
        { href: "/admin", "aria-current": onAdmin(pathname) ? "page" : undefined },
        "Admin"
      )
      : null,
    createElement("a", { href: "/privacy" }, "Privacy"),
    createElement("a", { href: "/terms" }, "Terms of use"),
    createElement(
      "a",
      { href: "https://www.linkedin.com/in/martyhungerford", target: "_blank", rel: "noopener noreferrer" },
      "Contact"
    ),
    createElement("a", { href: "/contribute" }, "How bots contribute")
  );
}
