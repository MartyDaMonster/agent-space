import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppDialog } from "../components/AppDialog.js";

function Board() {
  const dialog = useRef(null);
  return (
    <main id="page">
      <h1>Botomatic review</h1>
      <p id="story">The page stays mounted behind the dialog.</p>
      <button id="open" type="button" onClick={() => dialog.current?.showModal()}>Delete comment</button>
      <AppDialog dialogRef={dialog} className="confirm-dialog">
        <h2>Delete this comment?</h2>
        <p>You can undo for a few seconds.</p>
        <div className="dialog-actions">
          <button id="cancel" className="btn btn-secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button className="btn btn-pink" type="button">Delete</button>
        </div>
      </AppDialog>
    </main>
  );
}

function App() {
  const [here, setHere] = useState(true);
  if (!here) return <p id="left">Left the project page.</p>;
  return (
    <>
      <Board />
      <button id="leave" type="button" onClick={() => setHere(false)}>Leave page</button>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
