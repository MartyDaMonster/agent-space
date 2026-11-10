import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { devPreviewBlocked } from "../lib/dev-preview.js";
import { buildInviteEmail } from "../lib/invite-email.js";
import { renderCountdownGif } from "../lib/countdown-gif.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_invite_mail";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
process.env.ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";
delete process.env.RESEND_API_KEY;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

const martin = { user: { email: "marty.hungerford3181@gmail.com", githubLogin: "MartyDaMonster" } };

async function resetDatabase() {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_invite_mail' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_invite_mail");
  await admin.query("create database botomatic_invite_mail");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("invite email is a table and the countdown gif ticks until it expires", async () => {
  const message = buildInviteEmail({
    firstName: "Ada",
    joinUrl: "https://botomatic.dev/join/inv-ada",
    expiresAt: new Date("2026-11-12T09:00:00Z"),
    countdownUrl: "https://botomatic.dev/api/invite/inv-ada/countdown.gif",
    privacyUrl: "https://botomatic.dev/privacy",
    assetOrigin: "https://botomatic.dev"
  });
  assert.match(message.subject, /Ada, you're invited/);
  assert.match(message.html, /<table/);
  assert.match(message.html, /PRIVATE BETA/);
  assert.match(message.html, /Ada, you're invited\./);
  assert.match(message.html, /Accept your invite/);
  assert.match(message.html, /https:\/\/botomatic\.dev\/api\/invite\/inv-ada\/countdown\.gif/);
  assert.match(message.html, /email\/wordmark\.png/);
  assert.match(message.html, /ALL YOU NEED/);
  assert.match(message.html, /That's it\. You're in\./);
  assert.match(message.html, /We can't wait to see what you create\./);
  assert.match(message.html, /The team at BrandOSX/);
  assert.match(message.html, /BrandOSX Automation Pty Ltd/);
  assert.match(message.html, /v:roundrect/);
  assert.match(message.html, /color-scheme/);
  assert.match(message.html, /A small, hand-picked group/);
  assert.doesNotMatch(message.html, /<svg/i);
  assert.doesNotMatch(message.html, /box-shadow/i);
  assert.ok(Buffer.byteLength(message.html) < 102 * 1024);
  const plain = message.html.replace(/<style[\s\S]*?<\/style>/gi, "");
  const images = [...plain.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  assert.ok(images.length >= 2);
  for (const image of images) {
    assert.match(image, /alt="/);
    assert.match(image, /width="/);
    assert.match(image, /height="/);
  }
  assert.match(plain, /style="/);
  assert.match(plain, /text-align:center/);
  assert.match(message.html, /A GitHub account\./);
  assert.match(message.html, /At least two agentic platforms,/);
  assert.match(message.html, /font-size:42px/);
  const hostile = buildInviteEmail({
    firstName: "Ada\r\nBcc: evil@example.com <img>",
    joinUrl: "https://botomatic.dev/join/inv-ada",
    expiresAt: new Date("2026-11-12T09:00:00Z"),
    countdownUrl: "https://botomatic.dev/api/invite/inv-ada/countdown.gif",
    privacyUrl: "https://botomatic.dev/privacy",
    assetOrigin: "https://botomatic.dev"
  });
  assert.doesNotMatch(hostile.subject, /[\r\n]/);
  assert.doesNotMatch(hostile.html, /<img>/);
  assert.match(hostile.html, /&lt;img&gt;/);
  assert.match(message.text, /https:\/\/botomatic\.dev\/join\/inv-ada/);
  const live = await renderCountdownGif(new Date(Date.now() + 90_000));
  const expired = await renderCountdownGif(new Date(Date.now() - 1000));
  assert.equal(live.subarray(0, 6).toString(), "GIF89a");
  assert.equal(expired.subarray(0, 6).toString(), "GIF89a");
  assert.ok(live.length > expired.length);
});

test("an invite is created and emailed, and a missing key keeps the link", async () => {
  await resetDatabase();
  const { createAdminInvite, resendAdminInvite, listAdminInvites } = await import("../lib/admin-store.js");
  const { getSql } = await import("../lib/db.js");
  const sent = [];
  const created = await createAdminInvite(martin, {
    name: "Ada",
    email: "ada@example.com",
    githubLogin: "ada"
  }, {
    origin: "https://botomatic.dev",
    send: async (payload) => { sent.push(payload); }
  });
  assert.equal(created.ok, true);
  assert.equal(created.notice, "");
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /Ada, you're invited/);
  assert.match(sent[0].text, /\/join\//);
  const sql = getSql();
  const row = await sql`select invitee_name, sent_at, expires_at from workspace_invites where id = ${created.invite.id}`;
  assert.equal(row[0].invitee_name, "Ada");
  assert.ok(row[0].sent_at);
  const hours = (new Date(row[0].expires_at).getTime() - Date.now()) / 36e5;
  assert.ok(hours > 47 && hours < 49);
  delete process.env.RESEND_API_KEY;
  const quiet = await createAdminInvite(martin, { name: "Bea", email: "bea@example.com" });
  assert.equal(quiet.ok, true);
  assert.equal(quiet.notice, "Email not sent. Copy the link instead.");
  const listed = await listAdminInvites(martin);
  const bea = listed.invites.find((invite) => invite.email === "bea@example.com");
  assert.equal(bea.sentAt, null);
  assert.match(bea.sendError, /RESEND_API_KEY/);
  const again = await resendAdminInvite(martin, created.invite.id, {
    origin: "https://botomatic.dev",
    send: async (payload) => { sent.push(payload); }
  });
  assert.equal(again.ok, true);
  assert.equal(sent.length, 2);
  const renewed = await sql`select expires_at from workspace_invites where id = ${created.invite.id}`;
  const left = (new Date(renewed[0].expires_at).getTime() - Date.now()) / 36e5;
  assert.ok(left > 47 && left < 49);
  const { countdownResponse } = await import("../lib/countdown-route.js");
  const missing = await countdownResponse("nope");
  assert.equal(missing.status, 404);
  const found = await countdownResponse(created.invite.id);
  assert.equal(found.status, 200);
  assert.match(found.headers.get("cache-control"), /private/);
  const bytes = Buffer.from(await found.arrayBuffer());
  assert.equal(bytes.subarray(0, 6).toString(), "GIF89a");
  assert.equal(bytes.toString("utf8").includes("ada@example.com"), false);
  const hidden = await countdownResponse("preview");
  assert.equal(hidden.status, 404);
  assert.equal(await hidden.text(), "Not found");
  process.env.VERCEL_ENV = "production";
  assert.equal(devPreviewBlocked(), true);
  delete process.env.VERCEL_ENV;
  const { sendAdminTestEmail } = await import("../lib/admin-store.js");
  const denied = await sendAdminTestEmail({ user: { email: "ada@example.com", githubLogin: "ada" } });
  assert.equal(denied.ok, false);
  const preview = await sendAdminTestEmail(martin, {
    origin: "https://botomatic.dev",
    send: async (payload) => { sent.push(payload); }
  });
  assert.equal(preview.notice, "Test email sent.");
  assert.equal(sent.at(-1).to, "marty.hungerford3181@gmail.com");
  assert.match(sent.at(-1).html, /countdown\.gif/);
});
