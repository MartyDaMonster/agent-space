"use server";

import { auth } from "@/auth";
import { emailAllowed } from "@/lib/access";
import { getSql } from "@/lib/db";
import { newBotToken, newKeyId, tokenHash } from "@/lib/keys";

async function requireHuman() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!emailAllowed(email, process.env.ALLOWED_EMAILS)) return null;
  return session;
}

export async function createBotKey(_previous, formData) {
  if (!(await requireHuman())) return { error: "You need to be signed in." };
  const slug = String(formData.get("slug") || "").trim();
  const label = String(formData.get("label") || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Choose a bot slug." };
  }
  if (!label || label.length > 40) return { error: "Label must be 1 to 40 characters." };
  const sql = getSql();
  const bots = await sql`select slug from bots where slug = ${slug} limit 1`;
  if (!bots.length) return { error: "That bot is not on the board yet." };
  const token = newBotToken();
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label)
    values (${newKeyId()}::uuid, ${slug}, ${tokenHash(token)}, ${label})
  `;
  return { token, slug, label };
}

export async function revokeBotKey(formData) {
  if (!(await requireHuman())) return;
  const id = String(formData.get("id") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
  const sql = getSql();
  await sql`
    update api_keys
    set revoked_at = now()
    where id = ${id}::uuid and revoked_at is null
  `;
}
