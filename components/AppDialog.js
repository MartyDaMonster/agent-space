"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { focusableItems, tabDestination } from "@/lib/dialog";

export function AppDialog({ dialogRef, className = "", sheet = false, children, ...rest }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = dialogRef?.current;
    if (!mounted || !dialog) return undefined;
    const opener = { current: null };
    const showModal = dialog.showModal.bind(dialog);

    function sync() {
      document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
    }

    function restore() {
      const target = opener.current;
      opener.current = null;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    }

    dialog.showModal = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !dialog.contains(active)) opener.current = active;
      showModal();
    };

    function onClick(event) {
      if (event.target === dialog) dialog.close();
    }

    function onKey(event) {
      if (!dialog.open || event.key !== "Tab") return;
      const next = tabDestination(focusableItems(dialog), document.activeElement, event.shiftKey);
      if (!next) return;
      event.preventDefault();
      next.focus();
    }

    function onToggle(event) {
      sync();
      if (event.newState === "open" && document.activeElement?.classList?.contains("dialog-close")) dialog.focus();
    }

    function onClose() {
      sync();
      restore();
    }

    dialog.addEventListener("toggle", onToggle);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.showModal = showModal;
      dialog.removeEventListener("toggle", onToggle);
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("keydown", onKey);
      sync();
    };
  }, [mounted, dialogRef]);

  if (!mounted) return null;
  const classes = `app-dialog${sheet ? " is-sheet" : ""} ${className}`.trim();
  return createPortal(
    <dialog {...rest} ref={dialogRef} className={classes} tabIndex={-1} autoFocus>
      <div className="dialog-card">
        <button className="dialog-close" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
          <span aria-hidden="true">×</span>
        </button>
        {children}
      </div>
    </dialog>,
    document.body
  );
}
