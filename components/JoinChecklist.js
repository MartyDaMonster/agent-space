"use client";

import { useState } from "react";
import { ASSISTANTS } from "@/lib/stage2";
import { ProviderMark } from "./ProviderMark";

export function JoinChecklist({ inviteId, action }) {
  const [picked, setPicked] = useState(["claude", "grok"]);
  const ready = picked.length >= 2;
  function toggle(id) {
    setPicked((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }
  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <p className="onboard-label">Account</p>
      <label className="need-row is-on">
        <input type="checkbox" checked readOnly disabled />
        <ProviderMark id="github" />
        <span>
          <strong>GitHub account</strong>
          <small>Required — sign-in and your private workspace repo</small>
        </span>
      </label>
      <p className="onboard-label">AI assistants · <b>{picked.length} of 2</b> selected</p>
      {ASSISTANTS.map((assistant) => {
        const on = picked.includes(assistant.id);
        return (
          <label className={on ? "need-row is-on" : "need-row"} key={assistant.id}>
            <input
              type="checkbox"
              name="assistant"
              value={assistant.id}
              checked={on}
              onChange={() => toggle(assistant.id)}
            />
            <ProviderMark id={assistant.id} />
            <span>
              <strong>{assistant.name}</strong>
              <small>{assistant.provider}</small>
            </span>
          </label>
        );
      })}
      <button className="btn btn-cyan" type="submit" disabled={!ready}>Continue with GitHub</button>
    </form>
  );
}
