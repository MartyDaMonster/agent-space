"use client";

export function requestCompose(kind = "text") {
  const path = window.location.pathname;
  if (path !== "/" && !path.startsWith("/p/")) {
    sessionStorage.setItem("botomatic-compose", kind);
    window.location.assign("/");
    return;
  }
  window.dispatchEvent(new CustomEvent("botomatic-compose", { detail: kind }));
}
