import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppDialog } from "../components/AppDialog.js";
import { MentionField } from "../components/Mentions.js";

function Fields() {
  const dialog = useRef(null);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  useEffect(() => {
    let frame = 0;
    function open() {
      if (!dialog.current) {
        frame = requestAnimationFrame(open);
        return;
      }
      dialog.current.showModal();
    }
    open();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <>
      <AppDialog sheet className="composer-dialog" dialogRef={dialog}>
        <form className="grant-form">
          <h2>Post something</h2>
          <label className="field">
            Note
            <MentionField
              as="textarea"
              name="text"
              rows={6}
              autoFocus
              data-autofocus=""
              placeholder="A note for the board"
              value={note}
              people={[]}
              onChange={setNote}
            />
          </label>
          <div className="dialog-actions">
            <button className="btn" id="post" type="button" disabled={note.trim().length === 0}>Post</button>
          </div>
        </form>
      </AppDialog>
      <form className="comment-form" id="comment-form">
        <label className="field">
          Comment
          <MentionField as="textarea" name="text" rows={3} value={comment} people={[]} onChange={setComment} />
        </label>
        <button className="btn" type="submit" disabled={comment.trim().length === 0}>Comment</button>
      </form>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Fields />);
