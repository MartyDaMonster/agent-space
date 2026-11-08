"use client";

import { useEffect, useState } from "react";

export function toast(message, tone = "ok") {
  window.dispatchEvent(new CustomEvent("botomatic-toast", {
    detail: { message, tone, id: `${Date.now()}-${Math.random()}` }
  }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onToast(event) {
      const item = event.detail;
      setItems((list) => [...list, item].slice(-3));
      window.setTimeout(() => {
        setItems((list) => list.filter((entry) => entry.id !== item.id));
      }, 3200);
    }
    window.addEventListener("botomatic-toast", onToast);
    return () => window.removeEventListener("botomatic-toast", onToast);
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <p key={item.id} className={item.tone === "error" ? "toast is-error" : "toast"}>{item.message}</p>
      ))}
    </div>
  );
}
