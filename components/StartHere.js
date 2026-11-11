"use client";

import { useEffect, useState } from "react";
import { AvatarMark } from "./AvatarMark";
import { COACH_SESSION_KEY, coachShouldShow, coachStorageKey } from "@/lib/start-here";

function sessionId() {
  try {
    const existing = sessionStorage.getItem(COACH_SESSION_KEY);
    if (existing) return existing;
    const next = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(COACH_SESSION_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function visible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 8 && rect.height > 8;
}

function findTarget() {
  const primary = [...document.querySelectorAll("[data-add-bot='primary']")].find(visible);
  if (primary) return primary;
  return [...document.querySelectorAll("[data-add-bot='fallback']")].find(visible) || null;
}

function place(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(210, vw - 16);
  const cardH = 108;
  const bottomSafe = vw < 960 ? 80 : 12;
  const onLeft = rect.left < vw * 0.4;
  let arrow = "left";
  let left = rect.right + 16;
  let top = rect.top + rect.height / 2 - 40;
  if (onLeft && left + cardW <= vw - 8) {
    arrow = "left";
  } else if (rect.top > vh * 0.55) {
    arrow = "down";
    left = rect.left + rect.width / 2 - cardW / 2;
    top = rect.top - cardH - 14;
  } else if (left + cardW > vw - 8) {
    arrow = "right";
    left = rect.left - cardW - 16;
  }
  left = Math.max(8, Math.min(left, vw - cardW - 8));
  top = Math.max(8, Math.min(top, vh - cardH - bottomSafe));
  return { arrow, left, top, cardW, cardH, vw, vh };
}

export function StartHere({ workspaceId = "", botCount = null }) {
  const [show, setShow] = useState(false);
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const id = sessionId();
    let stored = "";
    try {
      stored = localStorage.getItem(coachStorageKey(workspaceId)) || "";
    } catch {
      stored = "";
    }
    if (!coachShouldShow({ botCount, workspaceId, stored, sessionId: id })) return undefined;
    setShow(true);
    let target = null;
    function measure() {
      target = findTarget();
      if (!target) {
        setFrame(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const pad = 6;
      const hole = {
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
      };
      setFrame({ hole, ...place(rect) });
    }
    function hide() {
      try {
        localStorage.setItem(coachStorageKey(workspaceId), sessionId());
      } catch {
        // Dismissal still hides the coach for this view.
      }
      setShow(false);
    }
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    function onClick(event) {
      const hit = event.target.closest?.("[data-add-bot]");
      if (hit && visible(hit)) hide();
    }
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [botCount, workspaceId]);

  if (!show || !frame) return null;
  const { hole, arrow, left, top, cardW, vw, vh } = frame;
  const clip = `polygon(evenodd, 0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, ${hole.left}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top + hole.height}px, ${hole.left}px ${hole.top + hole.height}px)`;
  return (
    <div className="coach" role="dialog" aria-label="Start here">
      <div className="coach-dim" style={{ clipPath: clip }} />
      <div className={`coach-card coach-arrow-${arrow}`} style={{ left, top, width: cardW }}>
        <button className="coach-x" type="button" aria-label="Dismiss" onClick={() => {
          try {
            localStorage.setItem(coachStorageKey(workspaceId), sessionId());
          } catch {
            // Still close.
          }
          setShow(false);
        }}>×</button>
        <span className="coach-crab" style={{ color: "#ff3e9a" }}>
          <AvatarMark shape="crab" motion="calm" seed="start-here" />
        </span>
        <p className="coach-sign">Start here!</p>
        <span className="coach-arrow" aria-hidden="true" />
      </div>
    </div>
  );
}
