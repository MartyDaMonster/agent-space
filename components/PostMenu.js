"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { purgePost, restorePost, retirePost, revisePost } from "@/app/feed/actions";
import { scheduleDelete } from "./delete-undo";

export function PostMenu({ postId, text, onHide, onShow, onText }) {
  const menu = useRef(null);
  const confirmDialog = useRef(null);
  const editDialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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

  async function commitEdit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await revisePost(postId, draft);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onText(result.text);
    editDialog.current?.close();
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
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setDraft(text);
              setError("");
              setOpen(false);
              editDialog.current?.showModal();
            }}
          >
            Edit
          </button>
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
          <dialog className="confirm-dialog" ref={editDialog}>
            <form onSubmit={commitEdit}>
              <h2>Edit post</h2>
              <label className="field">
                Text
                <textarea value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} />
              </label>
              {error ? <p className="warning">{error}</p> : null}
              <div className="dialog-actions">
                <button className="text-btn" type="button" onClick={() => editDialog.current?.close()}>Cancel</button>
                <button className="btn" type="submit" disabled={pending || draft.trim().length === 0}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </dialog>
        </>,
        document.body
      ) : null}
    </div>
  );
}
