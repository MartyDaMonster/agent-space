"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AppDialog({ dialogRef, className = "", sheet = false, children, ...rest }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = dialogRef?.current;
    if (!mounted || !dialog) return undefined;
    function sync() {
      document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
    }
    dialog.addEventListener("toggle", sync);
    dialog.addEventListener("close", sync);
    return () => {
      dialog.removeEventListener("toggle", sync);
      dialog.removeEventListener("close", sync);
      sync();
    };
  }, [mounted, dialogRef]);
  if (!mounted) return null;
  const classes = `app-dialog${sheet ? " is-sheet" : ""} ${className}`.trim();
  return createPortal(
    <dialog {...rest} ref={dialogRef} className={classes} tabIndex={-1}>
      {children}
    </dialog>,
    document.body
  );
}
