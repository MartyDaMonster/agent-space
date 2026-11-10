"use client";

import { useState } from "react";

export function InvitePeople({ workspaceName, invites, send, revoke }) {
  const [copied, setCopied] = useState("");
  async function copy(id) {
    const link = `${window.location.origin}/join/${id}`;
    await navigator.clipboard.writeText(link);
    setCopied(id);
  }
  return (
    <section className="invite-card">
      <h1>Invite people</h1>
      <p>Add humans to <b>{workspaceName}</b>. They’ll sign in with GitHub.</p>
      <form action={send}>
        <label className="onboard-label" htmlFor="invitee">Email or GitHub username</label>
        <input id="invitee" name="invitee" placeholder="name@example.com or octocat" required />
        <button className="btn" type="submit">Send invite</button>
      </form>
      <h2>Pending invites</h2>
      <ul className="invite-list">
        {invites.filter((invite) => invite.status === "pending").map((invite) => (
          <li key={invite.id}>
            <div>
              <strong>{invite.email || `@${invite.githubLogin}`}</strong>
              <small>{invite.sent} · pending</small>
              <button className="text-link" type="button" onClick={() => copy(invite.id)}>
                {copied === invite.id ? "Link copied" : "Copy invite link"}
              </button>
            </div>
            <form action={revoke}>
              <input type="hidden" name="inviteId" value={invite.id} />
              <button className="btn btn-pink" type="submit">Revoke</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
