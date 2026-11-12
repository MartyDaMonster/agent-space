import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import { subjectFor } from "./session-policy.js";

export function subjectFromToken(token = {}) {
  return subjectFor({
    githubId: token.githubId || "",
    email: token.email || ""
  });
}

export async function currentVersion(subject) {
  if (!subject) return 0;
  const sql = getSql();
  const rows = await sql`select version from auth_subjects where subject = ${subject} limit 1`;
  return Number(rows[0]?.version || 0);
}

export async function issueSession(subject) {
  if (!subject) return null;
  const sql = getSql();
  const existing = await sql`
    insert into auth_subjects (subject, version)
    values (${subject}, 1)
    on conflict (subject) do update set subject = excluded.subject
    returning version
  `;
  const version = Number(existing[0]?.version || 1);
  const id = `ses_${randomBytes(16).toString("hex")}`;
  await sql`
    insert into auth_sessions (id, subject, version)
    values (${id}, ${subject}, ${version})
  `;
  return { id, version };
}

export async function sessionLive(id, version) {
  if (!id) return false;
  const sql = getSql();
  const rows = await sql`
    select sessions.version as session_version, subjects.version as current_version
    from auth_sessions sessions
    join auth_subjects subjects on subjects.subject = sessions.subject
    where sessions.id = ${id} and sessions.revoked_at is null
    limit 1
  `;
  if (!rows.length) return false;
  const current = Number(rows[0].current_version);
  const issued = Number(rows[0].session_version);
  return issued === current && Number(version) === current;
}

export async function bumpSubject(subject) {
  if (!subject) return 0;
  const sql = getSql();
  const rows = await sql`
    insert into auth_subjects (subject, version, updated_at)
    values (${subject}, 2, now())
    on conflict (subject) do update
      set version = auth_subjects.version + 1,
          updated_at = now()
    returning version
  `;
  await sql`
    update auth_sessions
    set revoked_at = now()
    where subject = ${subject} and revoked_at is null
  `;
  return Number(rows[0]?.version || 0);
}

export async function bumpPeople(rows = []) {
  const seen = new Set();
  for (const row of rows) {
    const subjects = [
      subjectFor({ githubId: row.githubId || row.github_user_id || "" }),
      subjectFor({ email: row.email || "" })
    ];
    for (const subject of subjects) {
      if (!subject || seen.has(subject)) continue;
      seen.add(subject);
      await bumpSubject(subject);
    }
  }
}

export async function bumpWorkspaceMembers(workspaceId, email = "") {
  const sql = getSql();
  const mail = String(email || "").trim().toLowerCase();
  const rows = await sql`
    select email, github_user_id
    from workspace_members
    where workspace_id = ${workspaceId}
      and (${mail} = '' or lower(email) = ${mail})
  `;
  await bumpPeople(rows);
}
