import { createHash, randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import { allowInviteAction } from "./human-rate.js";
import { REAUTH_ERROR, requireFreshAuth } from "./session-policy.js";
import { SPACE_JOIN_CAP, ownedWorkspaces } from "./spaces.js";
import { workspaceRole } from "./workspace-session.js";

// A workspace owner accepts by adding one workspace they own, the same choice as a link invite.
// Someone who owns no workspace joins alone: their home workspace is only where posts are filed,
// and other people in that workspace do not gain access.

export function emailSubject(email) {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail.includes("@")) return "";
  return `em:${createHash("sha256").update(mail, "utf8").digest("hex")}`;
}

export function parsePersonSubject(subject) {
  const value = String(subject || "").trim();
  if (/^gh:\d+$/.test(value)) return { githubId: value.slice(3), emailHash: "" };
  if (/^em:[a-f0-9]{64}$/.test(value)) return { githubId: "", emailHash: value.slice(3) };
  return null;
}

function safeLabel(login, name) {
  const values = [login, name].map((value) => String(value || "").trim());
  return values.find((value) => value && !value.includes("@") && value.length <= 80) || "";
}

function sessionIdentity(session) {
  return {
    email: String(session?.user?.email || "").trim().toLowerCase(),
    githubId: String(session?.user?.githubId || "").trim()
  };
}

function inviteMatches(invite, session) {
  const { email, githubId } = sessionIdentity(session);
  const bound = String(invite?.target_github_id || "").trim();
  if (bound && githubId && bound === githubId) return true;
  if (bound && githubId && bound !== githubId) return false;
  const targetEmail = String(invite?.target_email || "").trim().toLowerCase();
  if (!targetEmail || !email || targetEmail !== email) return false;
  return !bound || !githubId || bound === githubId;
}

async function audit(spaceId, email, action, detail = "") {
  const sql = getSql();
  const id = `saud-${randomBytes(9).toString("hex")}`;
  await sql`
    insert into space_audit (id, space_id, actor_email, action, detail)
    values (${id}, ${spaceId}, ${String(email || "").toLowerCase()}, ${action}, ${detail || null})
  `;
}

async function subjectsInSpace(spaceId) {
  const sql = getSql();
  const direct = await sql`
    select subject as value from space_people where space_id = ${spaceId}
    union
    select target_subject as value from space_invites
    where space_id = ${spaceId}
      and invite_kind = 'person'
      and status = 'pending'
      and revoked_at is null
      and expires_at > now()
      and target_subject is not null
  `;
  const members = await sql`
    select members.github_user_id, members.email
    from space_workspaces
    join workspace_members members on members.workspace_id = space_workspaces.workspace_id
    where space_workspaces.space_id = ${spaceId}
      and members.suspended_at is null
  `;
  const subjects = new Set(direct.map((row) => row.value).filter(Boolean));
  for (const member of members) {
    const githubId = String(member.github_user_id || "").trim();
    if (/^\d+$/.test(githubId)) subjects.add(`gh:${githubId}`);
    const emailKey = emailSubject(member.email);
    if (emailKey) subjects.add(emailKey);
  }
  return subjects;
}

function publicPerson(person) {
  return { subject: person.subject, login: person.login, name: person.name };
}

export async function searchSpacePeople({ access, query }) {
  if (!access?.canModerate || !access.space?.id) return { ok: false, status: 404 };
  const needle = String(query || "").trim().slice(0, 40).replace(/[\\%_@]/g, "");
  if (needle.length < 2) return { ok: true, people: [] };
  const like = `%${needle}%`;
  const actorEmail = String(access.viewer?.email || "").trim().toLowerCase();
  const actorGithub = String(access.viewer?.githubId || "").trim();
  const sql = getSql();
  const rows = await sql`
    select
      btrim(coalesce(members.github_user_id, '')) as github_user_id,
      lower(members.email) as email,
      btrim(coalesce(members.github_login, '')) as github_login,
      coalesce((
        select humans.name from humans
        where lower(humans.email) = lower(members.email)
          and position('@' in humans.name) = 0
        order by humans.name asc
        limit 1
      ), '') as display_name
    from workspace_members members
    join workspaces on workspaces.id = members.workspace_id
    where members.suspended_at is null
      and workspaces.suspended_at is null
      and (
        (
          btrim(coalesce(members.github_login, '')) <> ''
          and position('@' in members.github_login) = 0
          and members.github_login ilike ${like}
        )
        or exists (
          select 1 from humans
          where lower(humans.email) = lower(members.email)
            and position('@' in humans.name) = 0
            and humans.name ilike ${like}
        )
      )
    order by members.github_login asc, members.email asc
    limit 40
  `;
  const excluded = await subjectsInSpace(access.space.id);
  const actorSubjects = new Set();
  if (/^\d+$/.test(actorGithub)) actorSubjects.add(`gh:${actorGithub}`);
  const actorEmailSubject = emailSubject(actorEmail);
  if (actorEmailSubject) actorSubjects.add(actorEmailSubject);
  const grouped = new Map();
  for (const row of rows) {
    const githubId = String(row.github_user_id || "").trim();
    const email = String(row.email || "").trim().toLowerCase();
    const subject = /^\d+$/.test(githubId) ? `gh:${githubId}` : emailSubject(email);
    if (!subject) continue;
    const current = grouped.get(subject) || { subject, login: "", name: "", email };
    const login = String(row.github_login || "").trim();
    const name = String(row.display_name || "").trim();
    if (login && !login.includes("@")) current.login = login;
    if (name && !name.includes("@")) current.name = name;
    current.email = email;
    grouped.set(subject, current);
  }
  const githubEmails = new Set(
    [...grouped.values()].filter((person) => person.subject.startsWith("gh:")).map((person) => person.email)
  );
  const people = [...grouped.values()].filter((person) => {
    if (person.subject.startsWith("em:") && githubEmails.has(person.email)) return false;
    if (excluded.has(person.subject)) return false;
    if (person.email && excluded.has(emailSubject(person.email))) return false;
    if (actorSubjects.has(person.subject)) return false;
    if (person.email && actorEmailSubject && person.email === actorEmail) return false;
    return Boolean(person.login || person.name);
  }).slice(0, 8).map(publicPerson);
  return { ok: true, people };
}

async function personBySubject(subject) {
  const parsed = parsePersonSubject(subject);
  if (!parsed) return null;
  const sql = getSql();
  const rows = await sql`
    select
      btrim(coalesce(members.github_user_id, '')) as github_user_id,
      lower(members.email) as email,
      btrim(coalesce(members.github_login, '')) as github_login,
      coalesce((
        select humans.name from humans
        where lower(humans.email) = lower(members.email)
          and position('@' in humans.name) = 0
        order by humans.name asc
        limit 1
      ), '') as display_name
    from workspace_members members
    join workspaces on workspaces.id = members.workspace_id
    where members.suspended_at is null
      and workspaces.suspended_at is null
      and (
        (${parsed.githubId} <> '' and btrim(coalesce(members.github_user_id, '')) = ${parsed.githubId})
        or (
          ${parsed.emailHash} <> ''
          and (members.github_user_id is null or btrim(members.github_user_id) = '')
          and encode(digest(convert_to(lower(members.email), 'UTF8'), 'sha256'), 'hex') = ${parsed.emailHash}
        )
      )
    limit 20
  `;
  if (!rows.length) return null;
  const githubId = String(rows.find((row) => /^\d+$/.test(String(row.github_user_id || "").trim()))?.github_user_id || "").trim();
  const email = String(rows[0].email || "").trim().toLowerCase();
  const login = rows.map((row) => String(row.github_login || "").trim()).find((value) => value && !value.includes("@")) || "";
  const name = rows.map((row) => String(row.display_name || "").trim()).find((value) => value && !value.includes("@")) || "";
  const label = safeLabel(login, name);
  const canonical = /^\d+$/.test(githubId) ? `gh:${githubId}` : emailSubject(email);
  if (!label || !canonical || canonical !== String(subject || "").trim()) return null;
  return { subject: canonical, githubId: /^\d+$/.test(githubId) ? githubId : "", email, login, name, label };
}

export async function createPersonInvite({ access, session, email, subject }) {
  if (!access?.canModerate || !access.space?.id) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  const actorEmail = String(email || access.viewer?.email || "").trim().toLowerCase();
  const sql = getSql();
  const current = await sql`select archived_at from spaces where id = ${access.space.id} limit 1`;
  if (!current.length) return { ok: false, status: 404 };
  if (current[0].archived_at || access.space.archivedAt) {
    return { ok: false, status: 400, error: "This space is archived." };
  }
  if (!allowInviteAction(actorEmail)) return { ok: false, status: 429, error: "Too many invites. Try again in a minute." };
  const person = await personBySubject(subject);
  if (!person) return { ok: false, status: 404 };
  const actorGithub = String(access.viewer?.githubId || session?.user?.githubId || "").trim();
  if (
    (actorGithub && person.githubId === actorGithub)
    || (actorEmail && person.email === actorEmail && (!person.githubId || !actorGithub || person.githubId === actorGithub))
  ) {
    return { ok: false, status: 404 };
  }
  const taken = await subjectsInSpace(access.space.id);
  if (taken.has(person.subject) || (person.email && taken.has(emailSubject(person.email)))) {
    return { ok: false, status: 400, error: "That person is already in this space or already invited." };
  }
  const id = `pinv-${randomBytes(9).toString("hex")}`;
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  try {
    await sql`
      insert into space_invites (
        id, space_id, created_by, status, expires_at, invite_kind,
        target_subject, target_github_id, target_email, target_label
      ) values (
        ${id},
        ${access.space.id},
        ${actorEmail},
        ${"pending"},
        ${expires},
        ${"person"},
        ${person.subject},
        ${person.githubId || null},
        ${person.email || null},
        ${person.label}
      )
    `;
  } catch (error) {
    if (error?.code === "23505") {
      return { ok: false, status: 400, error: "That person is already in this space or already invited." };
    }
    throw error;
  }
  await audit(access.space.id, actorEmail, "space.person.invited", person.label);
  return { ok: true };
}

export async function pendingPersonInvites(spaceId) {
  const sql = getSql();
  const rows = await sql`
    select id, target_label
    from space_invites
    where space_id = ${spaceId}
      and invite_kind = 'person'
      and status = 'pending'
      and revoked_at is null
      and expires_at > now()
    order by created_at desc
  `;
  return rows.map((row) => {
    const label = safeLabel(row.target_label, "");
    return { id: row.id, label: label || "Someone" };
  });
}

export async function spacePeople(spaceId) {
  const sql = getSql();
  const rows = await sql`
    select subject, github_login, display_name
    from space_people
    where space_id = ${spaceId}
    order by display_name asc, github_login asc
  `;
  return rows.map((row) => ({
    subject: row.subject,
    label: safeLabel(row.github_login, row.display_name)
  })).filter((person) => person.label);
}

async function loadPersonInvite(inviteId) {
  const id = String(inviteId || "").trim();
  if (!id) return null;
  const sql = getSql();
  const rows = await sql`
    select space_invites.id, space_invites.space_id, space_invites.status, space_invites.expires_at,
           space_invites.revoked_at, space_invites.created_at, space_invites.target_subject,
           space_invites.target_github_id, space_invites.target_email, space_invites.target_label,
           spaces.slug, spaces.name as space_name, spaces.owner_workspace_id, spaces.archived_at,
           workspaces.name as owner_name
    from space_invites
    join spaces on spaces.id = space_invites.space_id
    join workspaces on workspaces.id = spaces.owner_workspace_id
    where space_invites.id = ${id}
      and space_invites.invite_kind = 'person'
    limit 1
  `;
  return rows[0] || null;
}

function inviteOpen(invite) {
  if (!invite || invite.status !== "pending" || invite.revoked_at || invite.archived_at) return false;
  return new Date(invite.expires_at).getTime() > Date.now();
}

export async function personInvitesForSession(session) {
  const { email, githubId } = sessionIdentity(session);
  if (!email && !githubId) return [];
  const sql = getSql();
  const rows = await sql`
    select space_invites.id, spaces.name as space_name, workspaces.name as owner_name,
           space_invites.target_github_id, space_invites.target_email
    from space_invites
    join spaces on spaces.id = space_invites.space_id
    join workspaces on workspaces.id = spaces.owner_workspace_id
    where space_invites.invite_kind = 'person'
      and space_invites.status = 'pending'
      and space_invites.revoked_at is null
      and space_invites.expires_at > now()
      and (
        (${githubId} <> '' and space_invites.target_github_id = ${githubId})
        or (
          ${email} <> ''
          and lower(space_invites.target_email) = ${email}
          and (
            space_invites.target_github_id is null
            or btrim(space_invites.target_github_id) = ''
            or ${githubId} = ''
            or space_invites.target_github_id = ${githubId}
          )
        )
      )
    order by space_invites.created_at desc
  `;
  return rows.filter((row) => inviteMatches(row, session)).map((row) => ({
    id: row.id,
    spaceName: row.space_name,
    ownerName: row.owner_name
  }));
}

export async function previewPersonInvite(inviteId, session) {
  const invite = await loadPersonInvite(inviteId);
  if (!inviteOpen(invite) || !inviteMatches(invite, session)) return null;
  const owned = await ownedWorkspaces(session);
  const memberships = owned.length ? [] : await memberWorkspaces(session);
  return {
    id: invite.id,
    spaceName: invite.space_name,
    ownerName: invite.owner_name,
    owned,
    memberships
  };
}

async function memberWorkspaces(session) {
  const { email, githubId } = sessionIdentity(session);
  if (!email && !githubId) return [];
  const sql = getSql();
  const rows = await sql`
    select workspaces.id, workspaces.name
    from workspace_members
    join workspaces on workspaces.id = workspace_members.workspace_id
    where workspace_members.suspended_at is null
      and workspaces.suspended_at is null
      and (
        (${githubId} <> '' and workspace_members.github_user_id = ${githubId})
        or (
          ${email} <> ''
          and lower(workspace_members.email) = ${email}
          and (
            ${githubId} = ''
            or workspace_members.github_user_id is null
            or btrim(workspace_members.github_user_id) = ''
            or workspace_members.github_user_id = ${githubId}
          )
        )
      )
    order by workspaces.name asc
  `;
  const seen = new Map();
  for (const row of rows) seen.set(row.id, { id: row.id, name: row.name });
  return [...seen.values()];
}

async function workspaceBlocked(spaceId, workspaceId, createdAt) {
  const sql = getSql();
  const blocked = await sql`
    select blocked_at from space_workspace_blocks
    where space_id = ${spaceId} and workspace_id = ${workspaceId}
    limit 1
  `;
  if (!blocked.length) return false;
  return new Date(createdAt).getTime() <= new Date(blocked[0].blocked_at).getTime();
}

export async function acceptPersonInvite({ inviteId, session, workspaceId, asSelf = false }) {
  const invite = await loadPersonInvite(inviteId);
  if (!inviteOpen(invite) || !inviteMatches(invite, session)) return { ok: false, status: 404 };
  const { email } = sessionIdentity(session);
  if (!email || !workspaceId) return { ok: false, status: 404 };
  const sql = getSql();
  if (asSelf) {
    const owned = await ownedWorkspaces(session);
    if (owned.length) return { ok: false, status: 404 };
    const homes = await memberWorkspaces(session);
    if (!homes.some((workspace) => workspace.id === workspaceId)) return { ok: false, status: 404 };
    if (await workspaceBlocked(invite.space_id, workspaceId, invite.created_at)) return { ok: false, status: 404 };
    const counted = await sql`
      select count(*)::int as n from space_people where subject = ${invite.target_subject}
    `;
    if (Number(counted[0]?.n || 0) >= SPACE_JOIN_CAP) {
      return { ok: false, status: 400, error: "You are already in 20 spaces." };
    }
    const claimed = await claimPersonInvite(invite, email, null);
    if (!claimed) return { ok: false, status: 404 };
    const person = await personBySubject(invite.target_subject);
    await sql`
      insert into space_people (space_id, subject, home_workspace_id, github_user_id, email, github_login, display_name)
      values (
        ${invite.space_id},
        ${invite.target_subject},
        ${workspaceId},
        ${invite.target_github_id || null},
        ${invite.target_email || null},
        ${person?.login || null},
        ${safeLabel(invite.target_label, person?.name) || "Someone"}
      )
      on conflict (space_id, subject) do nothing
    `;
    await audit(invite.space_id, email, "space.person.accepted", invite.target_label || "");
    return { ok: true, slug: invite.slug };
  }
  const role = await workspaceRole(session, workspaceId);
  if (role !== "owner") return { ok: false, status: 404 };
  if (invite.owner_workspace_id === workspaceId) return { ok: false, status: 404 };
  const paused = await sql`
    select workspaces.suspended_at as workspace_paused, workspace_members.suspended_at as member_paused
    from workspaces
    join workspace_members on workspace_members.workspace_id = workspaces.id
    where workspaces.id = ${workspaceId}
      and lower(workspace_members.email) = ${email}
    limit 1
  `;
  if (!paused.length || paused[0].workspace_paused || paused[0].member_paused) return { ok: false, status: 404 };
  if (await workspaceBlocked(invite.space_id, workspaceId, invite.created_at)) return { ok: false, status: 404 };
  const joined = await sql`
    select count(*)::int as n from space_workspaces
    where workspace_id = ${workspaceId} and role = 'member'
  `;
  if (Number(joined[0]?.n || 0) >= SPACE_JOIN_CAP) {
    return { ok: false, status: 400, error: "This workspace is already in 20 spaces." };
  }
  const claimed = await claimPersonInvite(invite, email, workspaceId);
  if (!claimed) return { ok: false, status: 404 };
  await sql`
    insert into space_workspaces (space_id, workspace_id, role)
    values (${invite.space_id}, ${workspaceId}, ${"member"})
    on conflict (space_id, workspace_id) do nothing
  `;
  await audit(invite.space_id, email, "space.person.accepted", workspaceId);
  return { ok: true, slug: invite.slug };
}

async function claimPersonInvite(invite, email, workspaceId) {
  const sql = getSql();
  const claimed = await sql`
    update space_invites
    set status = 'accepted',
        accepted_workspace_id = ${workspaceId},
        accepted_by = ${email}
    where id = ${invite.id}
      and invite_kind = 'person'
      and status = 'pending'
      and revoked_at is null
      and expires_at > now()
    returning id
  `;
  return claimed.length > 0;
}

export async function declinePersonInvite({ inviteId, session }) {
  const invite = await loadPersonInvite(inviteId);
  if (!inviteOpen(invite) || !inviteMatches(invite, session)) return { ok: false, status: 404 };
  const { email } = sessionIdentity(session);
  const sql = getSql();
  const rows = await sql`
    update space_invites
    set status = 'declined'
    where id = ${invite.id}
      and status = 'pending'
      and revoked_at is null
    returning id
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await audit(invite.space_id, email, "space.person.declined", invite.target_label || "");
  return { ok: true };
}

export async function removeSpacePerson({ access, session, email, subject }) {
  if (!access?.canModerate || !access.space?.id) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  const parsed = parsePersonSubject(subject);
  if (!parsed) return { ok: false, status: 404 };
  const sql = getSql();
  const rows = await sql`
    delete from space_people
    where space_id = ${access.space.id}
      and subject = ${String(subject || "").trim()}
    returning subject, display_name
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await audit(access.space.id, email, "space.person.removed", safeLabel(rows[0].display_name, ""));
  return { ok: true };
}
