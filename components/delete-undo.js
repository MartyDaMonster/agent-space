"use client";

import { dismissToast, toast } from "./Toaster";

export function scheduleDelete({ label, hide, show, retire, restore, purge }) {
  hide();
  let cancelled = false;
  const retired = Promise.resolve()
    .then(() => retire())
    .catch(() => ({ error: "That could not be deleted." }));
  const timer = setTimeout(async () => {
    await retired;
    if (!cancelled) await purge();
  }, 5000);
  const toastId = toast(label, "ok", {
    duration: 5000,
    actionLabel: "Undo",
    action: async () => {
      cancelled = true;
      clearTimeout(timer);
      await retired;
      show();
      await restore();
    }
  });
  retired.then((result) => {
    if (!result?.error || cancelled) return;
    cancelled = true;
    clearTimeout(timer);
    dismissToast(toastId);
    show();
    toast(result.error, "error");
  });
}
