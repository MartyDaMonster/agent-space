import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { INVITE_ACTION_LIMIT, allowInviteAction } from "../lib/human-rate.js";
import { spaceAccess } from "../lib/space-access.js";
import {
  acceptPersonInvite,
  createPersonInvite,
  declinePersonInvite,
  emailSubject,
  pendingPersonInvites,
  personInvitesForSession,
  previewPersonInvite,
  removeSpacePerson,
  searchSpacePeople,
  spacePeople
} from "../lib/space-people.js";
import { createSpace, listSpacesForWorkspace, revokeSpaceInvite } from "../lib/spaces.js";
import { createSql, getSql, resetSqlCache } from "../lib/db.js";
import { applySchemaOnce, bundledStatements } from "../scripts/migrate.mjs";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_space_people";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = bundledStatements();

function sessionFor(email, githubId = "") {
  return { user: { email, githubId, name: email.split("@")[0], authAt: Math.floor(Date.now() / 1000) } };
}

function human(workspaceId, email, githubId = "", role = "member") {
  return { kind: "human", workspaceId, email, githubId, role };
}

function adaAccess(space) {
  return {
    ok: true,
    canModerate: true,
    space,
    viewer: { email: "ada@example.com", githubId: "111" }
  };
}

async function resetDatabase() {
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_space_people' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_space_people");
  await admin.query("create database botomatic_space_people");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("an owner can invite someone already on Botomatic, and only that person gets in", async () => {
  const form = readFileSync(new URL("../components/SpaceForms.js", import.meta.url), "utf8");
  const picker = form.slice(form.indexOf("export function AddPeopleForm"), form.indexOf("export function SpaceInviteForm"));
  assert.equal(picker.includes("email"), false);
  assert.equal(picker.includes("@"), false);
  const shell = readFileSync(new URL("../components/AppShell.js", import.meta.url), "utf8");
  const bannerSource = shell.slice(shell.indexOf("space-invite-banner"), shell.indexOf("space-strip"));
  assert.equal(bannerSource.includes("email"), false);
  assert.equal(bannerSource.includes("@"), false);

  await resetDatabase();
  const sql = getSql();
  const source = readFileSync(new URL("../scripts/migrate-space-people.sql", import.meta.url), "utf8");
  const first = await applySchemaOnce(sql, source);
  const second = await applySchemaOnce(sql, source);
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);

  await sql`
    insert into workspaces (id, name, slug) values
      ('ws-ada', 'Ada', 'ada'),
      ('ws-bea', 'Bea', 'bea'),
      ('ws-cy', 'Cy', 'cy'),
      ('ws-finn', 'Finn', 'finn'),
      ('ws-guest', 'Guest', 'guest')
  `;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, github_user_id, role) values
      ('ws-ada', 'ada@example.com', 'ada', '111', 'owner'),
      ('ws-bea', 'bea@example.com', 'bea', '222', 'owner'),
      ('ws-bea', 'gia@example.com', 'gia', '223', 'member'),
      ('ws-cy', 'cyd@example.com', 'cyd', '333', 'member'),
      ('ws-cy', 'noy@example.com', 'noy', '334', 'member'),
      ('ws-guest', 'dee@example.com', 'dee', '444', 'member'),
      ('ws-guest', 'eve@example.com', 'eve', '445', 'member'),
      ('ws-guest', 'nohub@example.com', 'nohub', null, 'member'),
      ('ws-finn', 'finn@example.com', 'finn', '555', 'owner'),
      ('ws-guest', 'leak@example.com', 'hidden@example.com', '666', 'member')
  `;
  await sql`
    insert into humans (email, name, workspace_id) values
      ('ada@example.com', 'Ada Lovelace', 'ws-ada'),
      ('bea@example.com', 'Bea Owner', 'ws-bea'),
      ('gia@example.com', 'Gia Guest', 'ws-bea'),
      ('cyd@example.com', 'Cyd Member', 'ws-cy'),
      ('noy@example.com', 'Noy Neighbor', 'ws-cy'),
      ('dee@example.com', 'Dee Decline', 'ws-guest'),
      ('eve@example.com', 'Eve Revoke', 'ws-guest'),
      ('nohub@example.com', 'No Hub', 'ws-guest'),
      ('finn@example.com', 'Finn Full', 'ws-finn'),
      ('leak@example.com', 'Plain Name', 'ws-guest')
  `;
  const hashed = await sql`
    select encode(digest(convert_to('nohub@example.com', 'UTF8'), 'sha256'), 'hex') as hash
  `;
  assert.equal(emailSubject("nohub@example.com"), `em:${hashed[0].hash}`);

  const testing = await createSpace({ workspaceId: "ws-ada", email: "ada@example.com", role: "owner", name: "Testing" });
  const quiet = await createSpace({ workspaceId: "ws-ada", email: "ada@example.com", role: "owner", name: "Quiet" });
  assert.equal(testing.ok, true, testing.error);
  const access = adaAccess(testing.space);
  const outsider = { ok: true, canModerate: false, space: testing.space, viewer: { email: "gia@example.com", githubId: "223" } };
  assert.equal((await searchSpacePeople({ access: outsider, query: "cyd" })).status, 404);
  assert.equal((await createPersonInvite({
    access: outsider,
    session: sessionFor("gia@example.com", "223"),
    email: "gia@example.com",
    subject: "gh:333"
  })).status, 404);
  assert.equal((await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:111"
  })).status, 404);

  const found = await searchSpacePeople({ access, query: "cyd" });
  assert.equal(found.ok, true);
  assert.deepEqual(found.people, [{ subject: "gh:333", login: "cyd", name: "Cyd Member" }]);
  const dumped = JSON.stringify(found.people);
  assert.equal(dumped.includes("@"), false);
  assert.equal(dumped.includes("cyd@example.com"), false);
  for (const person of found.people) assert.deepEqual(Object.keys(person).sort(), ["login", "name", "subject"]);
  assert.deepEqual(await searchSpacePeople({ access, query: "cyd@example.com" }), { ok: true, people: [] });
  const named = await searchSpacePeople({ access, query: "Lovelace" });
  assert.equal(named.people.some((person) => person.login === "ada"), false);
  const plain = await searchSpacePeople({ access, query: "Plain" });
  assert.deepEqual(plain.people, [{ subject: "gh:666", login: "", name: "Plain Name" }]);
  assert.equal(JSON.stringify(plain.people).includes("leak@"), false);
  assert.deepEqual(await searchSpacePeople({ access, query: "hidden" }), { ok: true, people: [] });
  const nohub = await searchSpacePeople({ access, query: "No Hub" });
  assert.equal(nohub.people[0].subject, emailSubject("nohub@example.com"));
  assert.equal(JSON.stringify(nohub.people).includes("@"), false);

  const invited = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: found.people[0].subject
  });
  assert.equal(invited.ok, true, invited.error);
  const pending = await pendingPersonInvites(testing.space.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].label, "cyd");
  assert.equal(JSON.stringify(pending).includes("@"), false);
  const cydSession = sessionFor("cyd@example.com", "333");
  const wrongGithub = sessionFor("cyd@example.com", "999");
  const banner = await personInvitesForSession(cydSession);
  assert.deepEqual(banner, [{ id: pending[0].id, spaceName: "Testing", ownerName: "Ada" }]);
  assert.equal(JSON.stringify(banner).includes("@"), false);
  assert.deepEqual(await personInvitesForSession(wrongGithub), []);
  assert.equal((await personInvitesForSession(sessionFor("noy@example.com", "334"))).length, 0);
  assert.equal((await spaceAccess(human("ws-cy", "cyd@example.com", "333"), "testing")).status, 404);
  assert.equal((await spaceAccess(human("ws-cy", "cyd@example.com", "333"), "quiet")).status, 404);
  const preview = await previewPersonInvite(pending[0].id, cydSession);
  assert.equal(preview.spaceName, "Testing");
  assert.equal(preview.owned.length, 0);
  assert.deepEqual(preview.memberships, [{ id: "ws-cy", name: "Cy" }]);
  assert.equal(JSON.stringify(preview).includes("@"), false);
  assert.equal(await previewPersonInvite(pending[0].id, wrongGithub), null);
  assert.equal(await previewPersonInvite(pending[0].id, sessionFor("noy@example.com", "334")), null);

  const accepted = await acceptPersonInvite({
    inviteId: pending[0].id,
    session: sessionFor("cyd@example.com"),
    workspaceId: "ws-cy",
    asSelf: true
  });
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.slug, "testing");
  const cyd = human("ws-cy", "cyd@example.com", "333");
  assert.equal((await spaceAccess(cyd, "testing")).ok, true);
  assert.equal((await spaceAccess(cyd, "testing")).canModerate, false);
  assert.equal((await spaceAccess(human("ws-cy", "cyd@example.com", "999"), "testing")).status, 404);
  assert.equal((await spaceAccess(human("ws-cy", "noy@example.com", "334"), "testing")).status, 404);
  assert.equal((await spaceAccess(cyd, "quiet")).status, 404);
  const cydSpaces = await listSpacesForWorkspace("ws-cy", { email: "cyd@example.com", githubId: "333" });
  assert.equal(cydSpaces.some((space) => space.slug === "testing"), true);
  const noySpaces = await listSpacesForWorkspace("ws-cy", { email: "noy@example.com", githubId: "334" });
  assert.equal(noySpaces.some((space) => space.slug === "testing"), false);
  assert.equal((await spacePeople(testing.space.id))[0].label, "cyd");
  assert.equal(JSON.stringify(await spacePeople(testing.space.id)).includes("@"), false);
  assert.deepEqual(await searchSpacePeople({ access, query: "cyd" }), { ok: true, people: [] });

  const removed = await removeSpacePerson({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:333"
  });
  assert.equal(removed.ok, true, removed.error);
  assert.equal((await spaceAccess(cyd, "testing")).status, 404);

  const dee = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:444"
  });
  assert.equal(dee.ok, true, dee.error);
  const deeInvite = (await personInvitesForSession(sessionFor("dee@example.com", "444")))[0];
  assert.equal(deeInvite.spaceName, "Testing");
  assert.equal((await declinePersonInvite({ inviteId: deeInvite.id, session: sessionFor("dee@example.com", "444") })).ok, true);
  assert.equal((await personInvitesForSession(sessionFor("dee@example.com", "444"))).length, 0);
  assert.equal((await spaceAccess(human("ws-guest", "dee@example.com", "444"), "testing")).status, 404);
  assert.equal((await acceptPersonInvite({
    inviteId: deeInvite.id,
    session: sessionFor("dee@example.com", "444"),
    workspaceId: "ws-guest",
    asSelf: true
  })).status, 404);

  const eve = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:445"
  });
  assert.equal(eve.ok, true, eve.error);
  const eveInvite = (await pendingPersonInvites(testing.space.id)).find((invite) => invite.label === "eve");
  assert.ok(eveInvite);
  assert.equal((await revokeSpaceInvite({
    access: outsider,
    session: sessionFor("gia@example.com", "223"),
    email: "gia@example.com",
    inviteId: eveInvite.id
  })).status, 404);
  assert.equal((await personInvitesForSession(sessionFor("eve@example.com", "445"))).length, 1);
  assert.equal((await revokeSpaceInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    inviteId: eveInvite.id
  })).ok, true);
  assert.equal((await personInvitesForSession(sessionFor("eve@example.com", "445"))).length, 0);
  assert.equal((await acceptPersonInvite({
    inviteId: eveInvite.id,
    session: sessionFor("eve@example.com", "445"),
    workspaceId: "ws-guest",
    asSelf: true
  })).status, 404);

  const beaInvite = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:222"
  });
  assert.equal(beaInvite.ok, true, beaInvite.error);
  const beaPending = (await personInvitesForSession(sessionFor("bea@example.com", "222")))[0];
  const beaPreview = await previewPersonInvite(beaPending.id, sessionFor("bea@example.com", "222"));
  assert.deepEqual(beaPreview.owned.map((workspace) => workspace.id), ["ws-bea"]);
  assert.equal(beaPreview.memberships.length, 0);
  assert.equal((await acceptPersonInvite({
    inviteId: beaPending.id,
    session: sessionFor("bea@example.com", "222"),
    workspaceId: "ws-bea",
    asSelf: true
  })).status, 404);
  const beaJoined = await acceptPersonInvite({
    inviteId: beaPending.id,
    session: sessionFor("bea@example.com", "222"),
    workspaceId: "ws-bea",
    asSelf: false
  });
  assert.equal(beaJoined.ok, true, beaJoined.error);
  assert.equal((await spaceAccess(human("ws-bea", "bea@example.com", "222", "owner"), "testing")).ok, true);
  assert.equal((await spaceAccess(human("ws-bea", "gia@example.com", "223"), "testing")).ok, true);
  assert.equal((await spaceAccess(human("ws-bea", "bea@example.com", "222", "owner"), "quiet")).status, 404);
  const personal = await sql`select count(*)::int as n from space_people where lower(email) = 'bea@example.com'`;
  assert.equal(personal[0].n, 0);

  for (let n = 0; n < 20; n += 1) {
    await sql`
      insert into space_people (space_id, subject, home_workspace_id, github_user_id, email, display_name)
      values (${`spc-cap-${n}`}, 'gh:333', 'ws-cy', '333', 'cyd@example.com', 'cyd')
    `;
  }
  const cappedInvite = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:333"
  });
  assert.equal(cappedInvite.ok, true, cappedInvite.error);
  const capped = await personInvitesForSession(cydSession);
  assert.equal((await acceptPersonInvite({
    inviteId: capped[0].id,
    session: cydSession,
    workspaceId: "ws-cy",
    asSelf: true
  })).error, "You are already in 20 spaces.");

  for (let n = 0; n < 20; n += 1) {
    await sql`
      insert into space_workspaces (space_id, workspace_id, role)
      values (${`spc-full-${n}`}, 'ws-finn', 'member')
    `;
  }
  const finnInvite = await createPersonInvite({
    access,
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:555"
  });
  assert.equal(finnInvite.ok, true, finnInvite.error);
  const finnPending = (await personInvitesForSession(sessionFor("finn@example.com", "555")))[0];
  assert.equal((await acceptPersonInvite({
    inviteId: finnPending.id,
    session: sessionFor("finn@example.com", "555"),
    workspaceId: "ws-finn"
  })).error, "This workspace is already in 20 spaces.");

  await sql`update spaces set archived_at = now() where id = ${quiet.space.id}`;
  assert.equal((await createPersonInvite({
    access: adaAccess(quiet.space),
    session: sessionFor("ada@example.com", "111"),
    email: "ada@example.com",
    subject: "gh:445"
  })).error, "This space is archived.");

  for (let n = 0; n < INVITE_ACTION_LIMIT; n += 1) assert.equal(allowInviteAction("burst@example.com"), true);
  assert.equal((await createPersonInvite({
    access,
    session: sessionFor("burst@example.com"),
    email: "burst@example.com",
    subject: "gh:445"
  })).status, 429);
});
