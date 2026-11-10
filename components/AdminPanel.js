"use client";

import { useActionState, useEffect, useState } from "react";
import { formatStorage, joinLink } from "@/lib/admin-panel";

function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
  }).format(date);
}

function Pill({ state }) {
  return <span className={`admin-pill is-${state}`}>{state}</span>;
}

function sentLabel(invite) {
  if (invite.state !== "pending" && invite.state !== "expired") return "";
  return invite.sentAt ? `Sent ${when(invite.sentAt)}` : "Not sent";
}

export function AdminStats({ stats }) {
  if (!stats) return null;
  const peak = Math.max(1, ...stats.traffic.bars);
  const blocks = [
    ["Today", stats.traffic.today],
    ["7 days", stats.traffic.week],
    ["30 days", stats.traffic.month]
  ];
  return (
    <section className="admin-card">
      <h2>Stats</h2>
      <div className="admin-stats">
        {blocks.map(([label, item]) => (
          <article className="stat-card" key={label}>
            <h3>{label}</h3>
            <strong>{item.views}</strong>
            <p>{item.visitors} visitors · {item.plays} video plays</p>
          </article>
        ))}
        <article className="stat-card stat-wide">
          <h3>Daily views</h3>
          <div className="spark" aria-hidden="true">
            {stats.traffic.bars.map((value, index) => (
              <i key={index} style={{ height: `${Math.max(8, Math.round((value / peak) * 100))}%` }} />
            ))}
          </div>
        </article>
        <article className="stat-card"><h3>Users</h3><strong>{stats.users}</strong><p>{stats.active} active in 7 days</p></article>
        <article className="stat-card"><h3>Invites</h3><strong>{stats.invites.rate}%</strong><p>{stats.invites.sent} sent · {stats.invites.accepted} accepted · {stats.invites.pending} pending · {stats.invites.expired} expired</p></article>
        <article className="stat-card"><h3>Workspaces</h3><strong>{stats.workspaces}</strong><p>{stats.bots} bots connected</p></article>
        <article className="stat-card"><h3>Last 7 days</h3><strong>{stats.posts}</strong><p>{stats.posts} posts · {stats.comments} comments · {stats.storage}</p></article>
      </div>
    </section>
  );
}

export function AdminPanel({ invites = [], people = [], audit = [], stats = null, send, sendTest, resend, revoke, suspend }) {
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [activity, setActivity] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [sent, sendForm, sending] = useActionState(send, null);
  const [tested, testForm, testing] = useActionState(sendTest, null);
  const shownAudit = auditOpen ? audit : audit.slice(0, 20);
  useEffect(() => {
    if (sent?.notice) setNotice(sent.notice);
    else if (sent?.error) setNotice(sent.error);
    else if (tested?.notice) setNotice(tested.notice);
    else if (tested?.error) setNotice(tested.error);
  }, [sent, tested]);

  async function copy(id) {
    await navigator.clipboard.writeText(joinLink(window.location.origin, id));
    setNotice("Invite link copied.");
  }

  return (
    <>
      <header className="admin-head">
        <h1>Admin</h1>
        <p>Invite-only beta</p>
      </header>
      {notice ? <p className="admin-note">{notice}</p> : null}

      <section className="admin-card">
        <div className="admin-card-head">
          <h2>Invite people</h2>
          <form action={testForm}>
            <button className="admin-btn" type="submit" disabled={testing}>{testing ? "Sending…" : "Send me a test"}</button>
          </form>
        </div>
        <form action={sendForm} className="admin-form">
          <label>
            First name
            <input name="name" required maxLength={40} placeholder="Ada" />
          </label>
          <label>
            Email
            <input name="email" type="email" required placeholder="name@example.com" />
          </label>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={sending}>{sending ? "Sending…" : "Invite"}</button>
        </form>
        {invites.length ? invites.map((invite) => (
          <div className="admin-row" key={invite.id}>
            <div>
              <strong>{invite.name ? `${invite.name} · ` : ""}{invite.email || `@${invite.githubLogin}`}</strong>
              <Pill state={invite.state} />
              <p className="admin-meta">{invite.githubLogin ? `@${invite.githubLogin} · ` : ""}{invite.workspaceName}{sentLabel(invite) ? ` · ${sentLabel(invite)}` : ""}</p>
            </div>
            <div className="admin-actions">
              <button className="admin-btn" type="button" onClick={() => copy(invite.id)}>Copy</button>
              {invite.state === "pending" || invite.state === "expired" ? (
                <form action={resend}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button className="admin-btn" type="submit">Resend</button>
                </form>
              ) : null}
              {invite.state === "pending" || invite.state === "expired" ? (
                <button
                  className="admin-btn admin-btn-danger"
                  type="button"
                  onClick={() => setConfirm({
                    title: "Revoke this invite?",
                    action: revoke,
                    fields: { inviteId: invite.id }
                  })}
                >Revoke</button>
              ) : null}
            </div>
          </div>
        )) : <p className="admin-empty">No invites yet.</p>}
      </section>

      <AdminStats stats={stats} />

      <section className="admin-card">
        <h2>People</h2>
        {people.length ? people.map((person) => (
          <div className="admin-row" key={`${person.workspaceId}-${person.email}`}>
            <div>
              <strong>{person.workspaceName}</strong>
              <Pill state={person.owner ? "owner" : person.paused ? "suspended" : "active"} />
              <p className="admin-meta">{person.email}{person.githubLogin ? ` · @${person.githubLogin}` : ""}</p>
              <p className="admin-meta">
                Joined {when(person.joinedAt)} · {person.bots} bots · {person.posts} posts · {person.comments} comments · {formatStorage(person.storageBytes)}
              </p>
              <button className="text-link" type="button" onClick={() => setActivity((open) => open === person.email ? "" : person.email)}>
                Show activity
              </button>
              {activity === person.email ? (
                <ul className="activity-feed">
                  {person.activity?.length ? person.activity.map((event, index) => (
                    <li key={`${event.at}-${index}`}>{event.kind}{event.botSlug ? ` · ${event.botSlug}` : ""} · {when(event.at)}</li>
                  )) : <li>No activity yet.</li>}
                </ul>
              ) : null}
            </div>
            {person.owner ? null : (
              <div className="admin-actions">
                <button
                  className={person.paused ? "admin-btn" : "admin-btn admin-btn-danger"}
                  type="button"
                  onClick={() => setConfirm({
                    title: person.paused ? `Resume ${person.email}?` : `Suspend ${person.email}?`,
                    action: suspend,
                    resume: person.paused,
                    fields: { workspaceId: person.workspaceId, email: person.email, scope: "person", resume: person.paused ? "1" : "" }
                  })}
                >{person.paused ? "Resume" : "Suspend"}</button>
              </div>
            )}
          </div>
        )) : <p className="admin-empty">No people yet.</p>}
      </section>

      <section className="admin-card">
        <h2>Audit log</h2>
        {shownAudit.length ? (
          <ul className="admin-audit">
            {shownAudit.map((entry) => (
              <li key={entry.id}>{when(entry.at)} · {entry.action}{entry.targetEmail ? ` · ${entry.targetEmail}` : ""}</li>
            ))}
          </ul>
        ) : <p className="admin-empty">No audit events yet.</p>}
        {audit.length > 20 && !auditOpen ? (
          <button className="text-link" type="button" onClick={() => setAuditOpen(true)}>Show all</button>
        ) : null}
      </section>

      {confirm ? (
        <dialog className="admin-card confirm-dialog" open>
          <form action={confirm.action}>
            <h2>{confirm.title}</h2>
            <p>This takes effect immediately.</p>
            {Object.entries(confirm.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="admin-actions">
              <button className="admin-btn" type="button" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={confirm.resume ? "admin-btn" : "admin-btn admin-btn-danger"} type="submit">Confirm</button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
