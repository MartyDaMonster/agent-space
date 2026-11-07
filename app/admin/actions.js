"use server";

import { auth } from "@/auth";
import { emailAllowed } from "@/lib/access";
import { getSql } from "@/lib/db";
import { prepareGrant } from "@/lib/grant";
import { newBotToken, newKeyId, tokenHash } from "@/lib/keys";
import { platformById } from "@/lib/platforms";
import { isSlug } from "@/lib/slug";
import { resolveAvatar } from "@/lib/store-avatar";

async function requireHuman() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!emailAllowed(email, process.env.ALLOWED_EMAILS)) return null;
  return session;
}

export async function grantAccess(_previous, formData) {
  if (!(await requireHuman())) return { error: "You need to be signed in." };
  const prepared = prepareGrant({
    name: formData.get("name"),
    slug: formData.get("slug"),
    platform: formData.get("platform")
  });
  if (!prepared.ok) return { error: prepared.error };
  const avatar = await resolveAvatar({
    slug: prepared.slug,
    preset: String(formData.get("preset") || ""),
    file: formData.get("image"),
    required: true
  });
  if (!avatar.ok) return { error: avatar.error };
  const platform = platformById(prepared.platform);
  const sql = getSql();
  const description = `Granted access on ${platform.label}.`.slice(0, 200);
  try {
    await sql`
      insert into bots (slug, name, color, avatar, description, platform, avatar_url)
      values (
        ${prepared.slug},
        ${prepared.name},
        ${platform.color},
        ${avatar.avatar},
        ${description},
        ${prepared.platform},
        ${avatar.url}
      )
    `;
  } catch (error) {
    if (error?.code === "23505") return { error: "That slug is already in use. Edit it and try again." };
    console.error(error instanceof Error ? error.message : "grant failed");
    return { error: "The bot could not be granted access." };
  }
  const token = newBotToken();
  try {
    await sql`
      insert into api_keys (id, bot_slug, key_hash, label)
      values (${newKeyId()}::uuid, ${prepared.slug}, ${tokenHash(token)}, ${prepared.name})
    `;
  } catch (error) {
    await sql`delete from bots where slug = ${prepared.slug}`;
    console.error(error instanceof Error ? error.message : "key failed");
    return { error: "The bot could not be granted access." };
  }
  return { token, name: prepared.name, slug: prepared.slug };
}

export async function updateBot(_previous, formData) {
  if (!(await requireHuman())) return { error: "You need to be signed in." };
  const slug = String(formData.get("slug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!isSlug(slug)) return { error: "That bot could not be found." };
  if (!name || name.length > 40) return { error: "Name must be 1 to 40 characters." };
  const avatar = await resolveAvatar({
    slug,
    preset: String(formData.get("preset") || ""),
    file: formData.get("image"),
    required: false
  });
  if (!avatar.ok) return { error: avatar.error };
  const sql = getSql();
  const rows = avatar.skipped
    ? await sql`update bots set name = ${name} where slug = ${slug} returning slug`
    : await sql`
      update bots
      set name = ${name}, avatar = ${avatar.avatar}, avatar_url = ${avatar.url}
      where slug = ${slug}
      returning slug
    `;
  if (!rows.length) return { error: "That bot could not be found." };
  return { saved: true };
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
