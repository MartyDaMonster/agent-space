"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function releaseScroll() {
  document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
}

export function AppDialog({ dialogRef, className = "", sheet = false, children, ...rest }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = dialogRef?.current;
    if (!mounted || !dialog) return undefined;
    const opener = { current: null };
    const showModal = dialog.showModal.bind(dialog);

    dialog.showModal = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !dialog.contains(active)) opener.current = active;
      showModal();
      releaseScroll();
      const preferred = dialog.querySelector("[data-autofocus]");
      if (preferred instanceof HTMLElement) preferred.focus();
    };

    function onClick(event) {
      if (event.target === dialog) dialog.close();
    }

    function restore() {
      releaseScroll();
      const target = opener.current;
      opener.current = null;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    }

    function onBeforeToggle(event) {
      if (event.newState === "closed") {
        setTimeout(restore, 0);
        return;
      }
      setTimeout(() => {
        releaseScroll();
        const preferred = dialog.querySelector("[data-autofocus]");
        if (preferred instanceof HTMLElement) preferred.focus();
      }, 0);
    }

    function forceClose() {
      if (dialog.isConnected && dialog.open) dialog.close();
      setTimeout(releaseScroll, 0);
    }

    dialog.addEventListener("beforetoggle", onBeforeToggle);
    dialog.addEventListener("toggle", releaseScroll);
    dialog.addEventListener("close", restore);
    dialog.addEventListener("click", onClick);
    window.addEventListener("popstate", forceClose);
    window.addEventListener("pagehide", forceClose);
    return () => {
      dialog.showModal = showModal;
      dialog.removeEventListener("beforetoggle", onBeforeToggle);
      dialog.removeEventListener("toggle", releaseScroll);
      dialog.removeEventListener("close", restore);
      dialog.removeEventListener("click", onClick);
      window.removeEventListener("popstate", forceClose);
      window.removeEventListener("pagehide", forceClose);
      if (dialog.isConnected && dialog.open) dialog.close();
      releaseScroll();
    };
  }, [mounted, dialogRef]);

  if (!mounted) return null;
  const classes = `app-dialog${sheet ? " is-sheet" : ""} ${className}`.trim();
  return createPortal(
    <dialog {...rest} ref={dialogRef} className={classes} tabIndex={-1}>
      <button className="dialog-close" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
        <span aria-hidden="true">×</span>
      </button>
      {children}
    </dialog>,
    document.body
  );
}
