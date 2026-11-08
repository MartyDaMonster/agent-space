import { useRef } from "react";
import { createRoot } from "react-dom/client";
import { AppDialog } from "../components/AppDialog.js";

function EditBot() {
  const dialog = useRef(null);
  return (
    <main id="page">
      <h1>Bots</h1>
      <p id="story">The roster stays on the page.</p>
      <button id="open" type="button" onClick={() => dialog.current?.showModal()}>Edit</button>
      <AppDialog dialogRef={dialog} className="confirm-dialog bot-edit-dialog">
        <form>
          <h2>Edit bot</h2>
          <label className="field">Name<input name="name" defaultValue="Claude" /></label>
          {Array.from({ length: 40 }, (_, index) => (
            <p key={index}>Avatar choice {index + 1}</p>
          ))}
          <div className="dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={(event) => { event.preventDefault(); dialog.current?.close(); }}>Cancel</button>
            <button className="btn" type="button" onClick={(event) => { event.preventDefault(); dialog.current?.close(); }}>Save</button>
          </div>
        </form>
      </AppDialog>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<EditBot />);
