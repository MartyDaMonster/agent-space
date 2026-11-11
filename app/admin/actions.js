"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { prepareBotEdit, prepareGrant, slugTakenMessage } from "@/lib/grant";
import { newBotToken, newKeyId, tokenHash } from "@/lib/keys";
import { platformById } from "@/lib/platforms";
import { isSlug } from "@/lib/slug";
import { resolveAvatar } from "@/lib/store-avatar";
import { workspaceActor } from "@/lib/workspace-session";

async function requireHuman() {
  return workspaceActor(await auth());
}

export async function grantAccess(_previous, formData) {
  const actor = await requireHuman();
  if (!actor) return { error: "You need to be signed in." };
  const prepared = prepareGrant({
    name: formData.get("name"),
    slug: formData.get("slug"),
    platform: formData.get("platform")
  });
  if (!prepared.ok) return { error: prepared.error };
  const avatar = resolveAvatar({
    shape: String(formData.get("shape") || ""),
    color: String(formData.get("color") || ""),
    required: true
  });
  if (!avatar.ok) return { error: avatar.error };
  const platform = platformById(prepared.platform);
  const sql = getSql();
  const description = `Granted access on ${platform.label}.`.slice(0, 200);
  try {
    await sql`
      insert into bots (slug, name, color, avatar, description, platform, avatar_url, avatar_shape, avatar_color, workspace_id)
      values (
        ${prepared.slug},
        ${prepared.name},
        ${platform.color},
        ${avatar.avatar},
        ${description},
        ${prepared.platform},
        ${avatar.url},
        ${avatar.shape},
        ${avatar.color},
        ${actor.workspaceId}
      )
    `;
  } catch (error) {
    const taken = slugTakenMessage(error);
    if (taken) return { error: taken };
    console.error(error instanceof Error ? error.message : "grant failed");
    return { error: "The bot could not be granted access." };
  }
  const token = newBotToken();
  try {
    await sql`
      insert into api_keys (id, bot_slug, key_hash, label, workspace_id)
      values (${newKeyId()}::uuid, ${prepared.slug}, ${tokenHash(token)}, ${prepared.name}, ${actor.workspaceId})
    `;
  } catch (error) {
    await sql`delete from bots where slug = ${prepared.slug} and workspace_id = ${actor.workspaceId}`;
    console.error(error instanceof Error ? error.message : "key failed");
    return { error: "The bot could not be granted access." };
  }
  return { token, name: prepared.name, slug: prepared.slug, platform: prepared.platform };
}

export async function updateBot(_previous, formData) {
  const actor = await requireHuman();
  if (!actor) return { error: "You need to be signed in." };
  const slug = String(formData.get("slug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!isSlug(slug)) return { error: "That bot could not be found." };
  if (!name || name.length > 40) return { error: "Name must be 1 to 40 characters." };
  const avatar = resolveAvatar({
    shape: String(formData.get("shape") || ""),
    color: String(formData.get("color") || ""),
    required: true
  });
  if (!avatar.ok) return { error: avatar.error };
  const sql = getSql();
  const rows = await sql`
    update bots
    set name = ${name},
        avatar = ${avatar.avatar},
        avatar_url = ${avatar.url},
        avatar_shape = ${avatar.shape},
        avatar_color = ${avatar.color}
    where slug = ${slug} and workspace_id = ${actor.workspaceId}
    returning slug
  `;
  if (!rows.length) return { error: "That bot could not be found." };
  return { saved: true };
}

export async function saveBotCard(_previous, formData) {
  const actor = await requireHuman();
  if (!actor) return { error: "You need to be signed in." };
  const slug = String(formData.get("slug") || "").trim();
  if (!isSlug(slug)) return { error: "That bot could not be found." };
  const prepared = prepareBotEdit({
    name: formData.get("name"),
    platform: formData.get("platform"),
    description: formData.get("description")
  });
  if (!prepared.ok) return { error: prepared.error };
  const avatar = resolveAvatar({
    shape: String(formData.get("shape") || ""),
    color: String(formData.get("color") || ""),
    required: true
  });
  if (!avatar.ok) return { error: avatar.error };
  const platform = platformById(prepared.platform);
  const sql = getSql();
  const rows = await sql`
    update bots
    set name = ${prepared.name},
        description = ${prepared.description},
        platform = ${prepared.platform},
        color = ${platform.color},
        avatar = ${avatar.avatar},
        avatar_url = ${avatar.url},
        avatar_shape = ${avatar.shape},
        avatar_color = ${avatar.color}
    where slug = ${slug} and workspace_id = ${actor.workspaceId}
    returning slug
  `;
  if (!rows.length) return { error: "That bot could not be found." };
  revalidatePath("/bots");
  revalidatePath("/admin");
  return { saved: true };
}

export async function revokeBotKey(formData) {
  const actor = await requireHuman();
  if (!actor) return;
  const id = String(formData.get("id") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
  const sql = getSql();
  await sql`
    update api_keys
    set revoked_at = now()
    where id = ${id}::uuid and workspace_id = ${actor.workspaceId} and revoked_at is null
  `;
}
