"use client";

import { useState } from "react";
import { joinLink } from "@/lib/admin-panel";

function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
  }).format(date);
}

export function AdminPanel({ workspaces, invites, people, audit, send, resend, revoke, suspend, revokeKey }) {
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(null);
  async function copy(id) {
    await navigator.clipboard.writeText(joinLink(window.location.origin, id));
    setNotice("Invite link copied.");
  }
  return (
    <section className="admin-panel">
      <h1>Admin</h1>
      <p>Invite-only beta. This panel is only for the allowlisted owner.</p>
      {notice ? <p className="onboard-note">{notice}</p> : null}

      <article className="onboard-card">
        <h2>Invite people</h2>
        <form action={send}>
          <label className="onboard-label" htmlFor="admin-email">Email</label>
          <input id="admin-email" name="email" type="email" required placeholder="name@example.com" />
          <label className="onboard-label" htmlFor="admin-github">GitHub username</label>
          <input id="admin-github" name="githubLogin" placeholder="optional" />
          <label className="onboard-label" htmlFor="admin-workspace">Workspace</label>
          <select id="admin-workspace" name="workspaceId" defaultValue={workspaces[0]?.id || ""}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <button className="btn" type="submit">Create invite link</button>
        </form>
        <ul className="invite-list">
          {invites.map((invite) => (
            <li key={invite.id}>
              <div>
                <strong>{invite.email || "No email"}{invite.githubLogin ? ` · @${invite.githubLogin}` : ""}</strong>
                <small>{invite.workspaceName} · {invite.state}</small>
              </div>
              <div className="bot-setup-actions">
                <button className="text-link" type="button" onClick={() => copy(invite.id)}>Copy link</button>
                {invite.state === "pending" || invite.state === "expired" ? (
                  <form action={resend}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button className="text-link" type="submit">Resend</button>
                  </form>
                ) : null}
                {invite.state === "pending" ? (
                  <form action={revoke}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button className="text-link" type="submit">Revoke</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="onboard-card">
        <h2>People</h2>
        {people.map((person) => (
          <section className="person-row" key={`${person.workspaceId}-${person.email}`}>
            <h3>{person.workspaceName}</h3>
            <p>{person.email}{person.githubLogin ? ` · @${person.githubLogin}` : ""}</p>
            <p className="onboard-note">
              Joined {when(person.joinedAt)} · Last active {when(person.lastActive)} · {person.bots} bots · {person.posts} posts · {person.comments} comments · {person.storageBytes} bytes stored
            </p>
            <ul className="activity-feed">
              {person.activity.map((event, index) => (
                <li key={`${event.kind}-${index}`}>{event.kind}{event.botSlug ? ` · ${event.botSlug}` : ""} · {when(event.at)}</li>
              ))}
            </ul>
            <div className="bot-setup-actions">
              {(person.keys || []).map((key) => (
                <button
                  key={key.id}
                  className="text-link"
                  type="button"
                  onClick={() => setConfirm({
                    scope: "key",
                    workspaceId: person.workspaceId,
                    keyId: key.id,
                    label: `Revoke ${key.slug}`
                  })}
                >
                  Revoke {key.slug}
                </button>
              ))}
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => setConfirm({
                  scope: "person",
                  workspaceId: person.workspaceId,
                  email: person.email,
                  resume: person.paused,
                  label: person.paused ? `Resume ${person.email}` : `Suspend ${person.email}`
                })}
              >
                {person.paused ? "Resume person" : "Suspend person"}
              </button>
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => setConfirm({
                  scope: "workspace",
                  workspaceId: person.workspaceId,
                  email: "",
                  resume: person.paused,
                  label: person.paused ? `Resume ${person.workspaceName}` : `Suspend ${person.workspaceName}`
                })}
              >
                {person.paused ? "Resume workspace" : "Suspend workspace"}
              </button>
            </div>
          </section>
        ))}
      </article>

      <article className="onboard-card">
        <h2>Audit log</h2>
        <ul className="activity-feed">
          {audit.map((entry, index) => (
            <li key={`${entry.action}-${index}`}>{entry.action} · {entry.target_email || entry.workspace_id || "—"} · {when(entry.created_at)}</li>
          ))}
        </ul>
      </article>

      {confirm ? (
        <dialog className="onboard-card confirm-dialog" open>
          <h2>{confirm.label}</h2>
          <p>This takes effect immediately.</p>
          <form action={confirm.scope === "key" ? revokeKey : suspend}>
            <input type="hidden" name="workspaceId" value={confirm.workspaceId} />
            <input type="hidden" name="email" value={confirm.email || ""} />
            <input type="hidden" name="scope" value={confirm.scope} />
            <input type="hidden" name="resume" value={confirm.resume ? "1" : ""} />
            <input type="hidden" name="keyId" value={confirm.keyId || ""} />
            <div className="bot-setup-actions">
              <button className="btn" type="submit">{confirm.resume ? "Resume" : "Confirm"}</button>
              <button className="text-link" type="button" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </form>
        </dialog>
      ) : null}
    </section>
  );
}
