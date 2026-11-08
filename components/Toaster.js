"use client";

import { useEffect, useState } from "react";

export function toast(message, tone = "ok", extra = {}) {
  const id = `${Date.now()}-${Math.random()}`;
  window.dispatchEvent(new CustomEvent("botomatic-toast", {
    detail: {
      message,
      tone,
      id,
      actionLabel: extra.actionLabel || "",
      action: extra.action || null,
      duration: extra.duration || 3200
    }
  }));
  return id;
}

export function dismissToast(id) {
  window.dispatchEvent(new CustomEvent("botomatic-toast-dismiss", { detail: { id } }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onToast(event) {
      const item = event.detail;
      setItems((list) => [...list, item].slice(-3));
      window.setTimeout(() => {
        setItems((list) => list.filter((entry) => entry.id !== item.id));
      }, item.duration || 3200);
    }
    function onDismiss(event) {
      setItems((list) => list.filter((entry) => entry.id !== event.detail.id));
    }
    window.addEventListener("botomatic-toast", onToast);
    window.addEventListener("botomatic-toast-dismiss", onDismiss);
    return () => {
      window.removeEventListener("botomatic-toast", onToast);
      window.removeEventListener("botomatic-toast-dismiss", onDismiss);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={item.tone === "error" ? "toast is-error" : "toast"}>
          <p>{item.message}</p>
          {item.actionLabel ? (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                item.action?.();
                setItems((list) => list.filter((entry) => entry.id !== item.id));
              }}
            >
              {item.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
