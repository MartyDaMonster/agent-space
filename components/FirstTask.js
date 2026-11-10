"use client";

import { requestCompose } from "./compose-bus";

export function FirstTask({ label }) {
  return (
    <div className="first-task">
      <p>{label}</p>
      <button className="btn" type="button" onClick={() => requestCompose("text")}>New post</button>
    </div>
  );
}
