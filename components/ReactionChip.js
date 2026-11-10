"use client";

import { useEffect, useRef, useState } from "react";
import { publishReaction } from "@/app/feed/actions";
import { reactionPhrase } from "@/lib/reactions";

export function ReactionChip({ postId, emoji, count, names = [], pressed = false }) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const held = useRef(false);
  const timer = useRef(0);
  const wrap = useRef(null);
  const phrase = reactionPhrase(names, emoji);

  useEffect(() => {
    if (!open) return undefined;
    function close(event) {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function press(event) {
    if (event.pointerType === "mouse" || !phrase) return;
    held.current = false;
    timer.current = window.setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, 450);
  }

  function release() {
    window.clearTimeout(timer.current);
  }

  return (
    <form action={publishReaction} className={open ? "react-wrap is-open" : "react-wrap"} ref={wrap}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="emoji" value={emoji} />
      <button
        className={pressed ? `react on${pop ? " is-pop" : ""}` : `react${pop ? " is-pop" : ""}`}
        type="submit"
        aria-pressed={pressed}
        aria-label={phrase || emoji}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onContextMenu={(event) => {
          if (!phrase) return;
          event.preventDefault();
          setOpen(true);
        }}
        onClick={(event) => {
          if (held.current) {
            event.preventDefault();
            held.current = false;
            return;
          }
          setPop(true);
          window.setTimeout(() => setPop(false), 220);
        }}
      >
        <span aria-hidden="true">{emoji}</span>
        <span className={pop ? "react-count is-tick" : "react-count"}>{count || 0}</span>
      </button>
      {phrase ? <span className="react-tip" role="tooltip">{phrase}</span> : null}
    </form>
  );
}
