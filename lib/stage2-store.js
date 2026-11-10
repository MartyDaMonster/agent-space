import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import { newKeyId, tokenHash } from "./keys.js";
import { slugFromName } from "./slug.js";
import {
  ASSISTANTS,
  assistantById,
  chosenAssistants,
  inviteMatchesIdentity,
  repoNameForSlug
} from "./stage2.js";
import { newLiveKey } from "./stage2-keys.js";

function mapInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email || "",
    githubLogin: row.github_login || "",
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    workspaceName: row.workspace_name || (row.own_workspace ? "New workspace" : ""),
    workspaceSlug: row.workspace_slug || "",
    ownWorkspace: Boolean(row.own_workspace)
  };
}

export async function createOwnedWorkspace({ name = "New workspace", email = "", githubLogin = "" } = {}) {
  const sql = getSql();
  const id = `ws-${randomBytes(4).toString("hex")}`;
  let slug = slugFromName(name) || "workspace";
  const taken = await sql`select id from workspaces where slug = ${slug} limit 1`;
  if (taken.length) slug = `${slug}-${id.slice(-4)}`.slice(0, 48);
  const login = String(githubLogin || "").trim().toLowerCase();
  const cleanEmail = String(email || "").trim().toLowerCase() || (login ? `${login}@users.noreply.github.com` : "");
  await sql`insert into workspaces (id, name, slug) values (${id}, ${name || "New workspace"}, ${slug})`;
  if (cleanEmail) {
    await sql`
      insert into workspace_members (workspace_id, email, github_login, role)
      values (${id}, ${cleanEmail}, ${login || null}, 'owner')
      on conflict (workspace_id, email) do nothing
    `;
    await sql`
      insert into humans (email, name, workspace_id)
      values (${cleanEmail}, ${name || cleanEmail}, ${id})
      on conflict (workspace_id, email) do nothing
    `;
  }
  return id;
}

export async function acceptOwnWorkspaceInvite(inviteId, identity = {}) {
  const sql = getSql();
  const invite = await inviteCard(inviteId);
  if (!invite?.ownWorkspace) return { ok: false, status: 404, error: "That invite is not open." };
  if (!inviteMatchesIdentity(invite, identity)) return { ok: false, status: 404, error: "That invite is not open." };
  const draft = await loadDraft(inviteId);
  let workspaceId = draft?.createdWorkspaceId || "";
  if (!workspaceId) {
    workspaceId = await createOwnedWorkspace({
      name: draft?.workspaceName || "New workspace",
      email: identity.email || invite.email,
      githubLogin: identity.githubLogin || invite.githubLogin
    });
  }
  if (workspaceId === "ws-martin") return { ok: false, status: 404, error: "That invite is not open." };
  await sql`
    update workspace_invites
    set status = 'accepted', accepted_at = now(), workspace_id = ${workspaceId}
    where id = ${inviteId} and own_workspace = true
  `;
  if (draft) {
    await sql`
      update onboarding_drafts
      set workspace_id = ${workspaceId}, created_workspace_id = ${workspaceId}, updated_at = now()
      where invite_id = ${inviteId}
    `;
  }
  const members = await sql`
    select workspace_id, role from workspace_members
    where workspace_id = ${workspaceId}
      and lower(email) = ${String(identity.email || invite.email || "").trim().toLowerCase()}
  `;
  return {
    ok: true,
    invite: { ...invite, status: "accepted", workspaceId },
    membership: { workspaceId, role: members[0]?.role || "owner" }
  };
}

export async function inviteCard(inviteId) {
  const sql = getSql();
  const rows = await sql`
    select invites.id, invites.workspace_id, invites.email, invites.github_login, invites.status,
           invites.created_by, invites.created_at, invites.own_workspace,
           workspaces.name as workspace_name, workspaces.slug as workspace_slug
    from workspace_invites invites
    left join workspaces on workspaces.id = invites.workspace_id
    where invites.id = ${inviteId}
    limit 1
  `;
  return mapInvite(rows[0]);
}

export async function pendingInviteForIdentity({ email = "", githubLogin = "" } = {}) {
  const sql = getSql();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim().toLowerCase();
  if (!cleanEmail && !login) return null;
  const rows = await sql`
    select id, workspace_id, email, github_login, status, created_by, created_at
    from workspace_invites
    where status = 'pending'
      and (
        (${cleanEmail} <> '' and email is not null and lower(email) = ${cleanEmail})
        or (${login} <> '' and github_login is not null and lower(github_login) = ${login})
      )
    order by created_at desc
    limit 1
  `;
  const invite = mapInvite(rows[0]);
  return invite && inviteMatchesIdentity(invite, { email: cleanEmail, githubLogin: login }) ? invite : null;
}

export async function saveAssistantChoice(inviteId, assistantIds) {
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status !== "pending") return { ok: false, status: 404, error: "That invite is not open." };
  const assistants = chosenAssistants(assistantIds);
  if (assistants.length < 2) return { ok: false, status: 400, error: "Pick at least two assistants." };
  const sql = getSql();
  await sql`
    insert into onboarding_drafts (invite_id, workspace_id, assistants, workspace_name, repo_name, repo_status)
    values (
      ${invite.id},
      ${invite.workspaceId},
      ${JSON.stringify(assistants)}::jsonb,
      ${invite.workspaceName},
      ${repoNameForSlug(invite.workspaceSlug)},
      'pending'
    )
    on conflict (invite_id) do update
      set assistants = excluded.assistants,
          updated_at = now()
      where onboarding_drafts.finished_at is null
        and onboarding_drafts.github_login is null
  `;
  return { ok: true, assistants };
}

function mapDraft(row) {
  if (!row) return null;
  const assistants = Array.isArray(row.assistants) ? row.assistants : [];
  return {
    inviteId: row.invite_id,
    sourceWorkspaceId: row.workspace_id,
    githubLogin: row.github_login || "",
    email: row.email || "",
    assistants,
    workspaceName: row.workspace_name || "",
    avatarShape: row.avatar_shape || "",
    avatarColor: row.avatar_color || "",
    repoName: row.repo_name || "",
    repoStatus: row.repo_status || "pending",
    createdWorkspaceId: row.created_workspace_id || "",
    finishedAt: row.finished_at || null
  };
}

export async function openDraftForSession(session) {
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const login = String(session?.user?.githubLogin || "").trim().toLowerCase();
  if (!email && !login) return null;
  const sql = getSql();
  const rows = await sql`
    select invite_id, workspace_id, github_login, email, assistants, workspace_name,
           avatar_shape, avatar_color, repo_name, repo_status, created_workspace_id, finished_at
    from onboarding_drafts
    where finished_at is null
      and (
        (${login} <> '' and github_login is not null and lower(github_login) = ${login})
        or (${email} <> '' and email is not null and lower(email) = ${email})
      )
    order by updated_at desc
    limit 1
  `;
  return mapDraft(rows[0]);
}

export async function workspaceTitle(workspaceId) {
  const sql = getSql();
  const rows = await sql`select name from workspaces where id = ${workspaceId} limit 1`;
  return rows[0]?.name || "";
}

export async function loadDraft(inviteId) {
  const sql = getSql();
  const rows = await sql`
    select invite_id, workspace_id, github_login, email, assistants, workspace_name,
           avatar_shape, avatar_color, repo_name, repo_status, created_workspace_id, finished_at
    from onboarding_drafts
    where invite_id = ${inviteId}
    limit 1
  `;
  return mapDraft(rows[0]);
}

function samePerson(draft, session) {
  if (!draft) return false;
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const login = String(session?.user?.githubLogin || "").trim().toLowerCase();
  if (draft.githubLogin && login && draft.githubLogin === login) return true;
  if (draft.email && email && draft.email === email) return true;
  if (!draft.githubLogin && !draft.email) return false;
  return false;
}

export async function bindDraftToSession(inviteId, session) {
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") return { ok: false, status: 404, error: "That invite is not open." };
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const login = String(session?.user?.githubLogin || "").trim().toLowerCase();
  if (!inviteMatchesIdentity(invite, { email, githubLogin: login }) && invite.status === "pending") {
    return { ok: false, status: 404, error: "That invite is not open." };
  }
  if (invite.status === "accepted") {
    const draft = await loadDraft(inviteId);
    if (!draft || !samePerson(draft, session)) return { ok: false, status: 404, error: "That invite is not open." };
    return { ok: true, draft, invite };
  }
  const sql = getSql();
  await sql`
    insert into onboarding_drafts (invite_id, workspace_id, github_login, email, workspace_name, repo_name)
    values (
      ${invite.id},
      ${invite.workspaceId},
      ${login || null},
      ${email || null},
      ${invite.workspaceName},
      ${repoNameForSlug(invite.workspaceSlug)}
    )
    on conflict (invite_id) do update
      set github_login = coalesce(onboarding_drafts.github_login, excluded.github_login),
          email = coalesce(onboarding_drafts.email, excluded.email),
          updated_at = now()
      where onboarding_drafts.github_login is null
         or onboarding_drafts.github_login = excluded.github_login
  `;
  const draft = await loadDraft(inviteId);
  if (!samePerson(draft, session)) return { ok: false, status: 404, error: "That invite is not open." };
  return { ok: true, draft, invite };
}

export async function markRepo(inviteId, session, { status, name }) {
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) return bound;
  const sql = getSql();
  await sql`
    update onboarding_drafts
    set repo_status = ${status},
        repo_name = coalesce(${name || null}, repo_name),
        updated_at = now()
    where invite_id = ${inviteId}
      and finished_at is null
  `;
  return { ok: true, draft: await loadDraft(inviteId) };
}

export async function saveWorkspaceStep(inviteId, session, { name, shape, color }) {
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) return bound;
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) return { ok: false, status: 400, error: "Name your workspace." };
  const sql = getSql();
  await sql`
    update onboarding_drafts
    set workspace_name = ${clean},
        avatar_shape = ${shape || null},
        avatar_color = ${color || null},
        updated_at = now()
    where invite_id = ${inviteId}
      and finished_at is null
  `;
  return { ok: true, draft: await loadDraft(inviteId) };
}

async function ensureWorkspace(draft, session) {
  if (draft.createdWorkspaceId) return draft.createdWorkspaceId;
  const sql = getSql();
  const id = `ws-${randomBytes(4).toString("hex")}`;
  let slug = slugFromName(draft.workspaceName) || "workspace";
  const taken = await sql`select id from workspaces where slug = ${slug} limit 1`;
  if (taken.length) slug = `${slug}-${id.slice(-4)}`.slice(0, 48);
  const login = String(session?.user?.githubLogin || draft.githubLogin || "").trim().toLowerCase();
  const email = String(session?.user?.email || draft.email || "").trim().toLowerCase()
    || (login ? `${login}@users.noreply.github.com` : "");
  await sql`
    insert into workspaces (id, name, slug)
    values (${id}, ${draft.workspaceName || "Workspace"}, ${slug})
  `;
  if (email) {
    await sql`
      insert into workspace_members (workspace_id, email, github_login, role)
      values (${id}, ${email}, ${login || null}, 'owner')
      on conflict (workspace_id, email) do nothing
    `;
    await sql`
      insert into humans (email, name, avatar_shape, avatar_color, workspace_id, onboarded_at)
      values (
        ${email},
        ${session?.user?.name || email},
        ${draft.avatarShape || "square"},
        ${draft.avatarColor || "lime"},
        ${id},
        now()
      )
      on conflict (workspace_id, email) do update
        set avatar_shape = excluded.avatar_shape,
            avatar_color = excluded.avatar_color,
            onboarded_at = coalesce(humans.onboarded_at, now())
    `;
  }
  await sql`
    update onboarding_drafts
    set created_workspace_id = ${id}, updated_at = now()
    where invite_id = ${draft.inviteId}
  `;
  return id;
}

export async function ensureBots(inviteId, session) {
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) return bound;
  const draft = bound.draft;
  if (!draft.assistants?.length) return { ok: false, status: 400, error: "Pick at least two assistants." };
  const workspaceId = await ensureWorkspace(draft, session);
  const sql = getSql();
  const revealed = [];
  for (const id of draft.assistants) {
    const assistant = assistantById(id);
    if (!assistant) continue;
    const existing = await sql`
      select slug from bots where slug = ${assistant.slug} and workspace_id = ${workspaceId} limit 1
    `;
    if (!existing.length) {
      await sql`
        insert into bots (slug, name, color, avatar, description, platform, avatar_shape, avatar_color, workspace_id)
        values (
          ${assistant.slug},
          ${assistant.name},
          '#c6ff3d',
          'square-lime',
          ${`Setup for ${assistant.name}`},
          ${assistant.id},
          'square',
          'lime',
          ${workspaceId}
        )
      `;
    }
    const key = await sql`
      select key_last4, last_seen_at from api_keys
      where bot_slug = ${assistant.slug} and workspace_id = ${workspaceId} and revoked_at is null
      order by created_at desc
      limit 1
    `;
    if (!key.length) {
      const fresh = newLiveKey();
      await sql`
        insert into api_keys (id, bot_slug, key_hash, label, workspace_id, key_last4)
        values (${newKeyId()}::uuid, ${assistant.slug}, ${tokenHash(fresh.token)}, ${assistant.name}, ${workspaceId}, ${fresh.last4})
      `;
      revealed.push({ slug: assistant.slug, token: fresh.token, last4: fresh.last4 });
    }
  }
  return { ok: true, workspaceId, revealed, draft: await loadDraft(inviteId) };
}

export async function botsForDraft(inviteId, session) {
  const bound = await bindDraftToSession(inviteId, session);
  if (!bound.ok) return bound;
  const draft = await loadDraft(inviteId);
  if (!draft?.createdWorkspaceId) return { ok: true, bots: [], workspaceId: "" };
  const sql = getSql();
  const rows = await sql`
    select bots.slug, bots.name, keys.key_last4, keys.last_seen_at
    from bots
    left join api_keys keys
      on keys.bot_slug = bots.slug
     and keys.workspace_id = bots.workspace_id
     and keys.revoked_at is null
    where bots.workspace_id = ${draft.createdWorkspaceId}
    order by bots.name asc
  `;
  const wanted = new Set(draft.assistants || []);
  const bots = rows
    .filter((row) => wanted.has(ASSISTANTS.find((item) => item.slug === row.slug)?.id))
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      last4: row.key_last4 || "",
      connected: Boolean(row.last_seen_at)
    }));
  return { ok: true, bots, workspaceId: draft.createdWorkspaceId };
}

export async function regenerateBotKey(inviteId, session, slug) {
  const listed = await botsForDraft(inviteId, session);
  if (!listed.ok) return listed;
  const bot = listed.bots.find((item) => item.slug === slug);
  if (!bot) return { ok: false, status: 404, error: "That bot is not in this workspace." };
  const fresh = newLiveKey();
  const sql = getSql();
  await sql`
    update api_keys
    set revoked_at = now()
    where bot_slug = ${slug} and workspace_id = ${listed.workspaceId} and revoked_at is null
  `;
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id, key_last4)
    values (${newKeyId()}::uuid, ${slug}, ${tokenHash(fresh.token)}, ${bot.name}, ${listed.workspaceId}, ${fresh.last4})
  `;
  return { ok: true, token: fresh.token, last4: fresh.last4, workspaceId: listed.workspaceId };
}

export async function finishOnboardingDraft(inviteId, session) {
  const listed = await botsForDraft(inviteId, session);
  if (!listed.ok) return listed;
  if (!listed.bots.length || listed.bots.some((bot) => !bot.connected)) {
    return { ok: false, status: 400, error: "Connect every bot before you finish." };
  }
  const sql = getSql();
  await sql`
    update workspace_invites
    set status = 'accepted', accepted_at = now()
    where id = ${inviteId} and status = 'pending'
  `;
  await sql`
    update onboarding_drafts
    set finished_at = coalesce(finished_at, now()), updated_at = now()
    where invite_id = ${inviteId}
  `;
  const draft = await loadDraft(inviteId);
  return {
    ok: true,
    workspaceId: draft.createdWorkspaceId,
    sourceWorkspaceId: draft.sourceWorkspaceId
  };
}
