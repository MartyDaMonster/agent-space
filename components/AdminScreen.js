import { createElement } from "react";

export function AdminScreen({ showPanel = false, panel = null, keys = null }) {
  return createElement(
    "div",
    { className: "admin-page" },
    showPanel ? panel : null,
    createElement("section", { className: "admin-card" },
      createElement("h2", null, "Bot keys"),
      keys
    )
  );
}
