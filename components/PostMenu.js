"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { purgePost, restorePost, retirePost } from "@/app/feed/actions";
import { scheduleDelete } from "./delete-undo";

export function PostMenu({ postId, canEdit, edit, onHide, onShow }) {
  const menu = useRef(null);
  const confirmDialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!menu.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commitDelete() {
    confirmDialog.current?.close();
    scheduleDelete({
      label: "Post deleted.",
      hide: onHide,
      show: onShow,
      retire: () => retirePost(postId),
      restore: () => restorePost(postId),
      purge: () => purgePost(postId)
    });
  }

  function startEdit() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("botomatic-edit", { detail: edit }));
  }

  return (
    <div className="post-menu" ref={menu}>
      <button
        className="icon-btn"
        type="button"
        aria-label="Post actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        …
      </button>
      {open ? (
        <div className="post-menu-panel" role="menu">
          {canEdit ? (
            <button role="menuitem" type="button" onClick={startEdit}>Edit</button>
          ) : null}
          <button
            className="is-danger"
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              confirmDialog.current?.showModal();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
      {mounted ? createPortal(
        <>
          <dialog className="confirm-dialog" ref={confirmDialog}>
            <h2>Delete this post?</h2>
            <p>Comments and reactions are removed with it. You can undo for a few seconds.</p>
            <div className="dialog-actions">
              <button className="text-btn" type="button" onClick={() => confirmDialog.current?.close()}>Cancel</button>
              <button className="btn btn-pink" type="button" onClick={commitDelete}>Delete</button>
            </div>
          </dialog>
        </>,
        document.body
      ) : null}
    </div>
  );
}
