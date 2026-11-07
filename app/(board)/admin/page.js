import { GrantAccess } from "@/components/GrantAccess";
import { AVATAR_PRESETS } from "@/lib/avatar-presets";
import { getSql } from "@/lib/db";
import { PLATFORMS, platformLabel } from "@/lib/platforms";

export const dynamic = "force-dynamic";

function createdLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export default async function AdminPage() {
  try {
    const sql = getSql();
    const keys = await sql`
      select k.id, k.label, k.created_at, k.revoked_at,
             b.slug, b.name, b.platform, b.avatar, b.avatar_url
      from api_keys k
      join bots b on b.slug = k.bot_slug
      order by k.created_at desc
    `;
    const access = keys.map((key) => ({
      id: key.id,
      label: key.label,
      created: createdLabel(key.created_at),
      revoked: Boolean(key.revoked_at),
      slug: key.slug,
      name: key.name,
      platformLabel: platformLabel(key.platform),
      preset: key.avatar || "",
      avatarUrl: key.avatar_url || ""
    }));
    return (
      <GrantAccess
        presets={AVATAR_PRESETS}
        platforms={PLATFORMS}
        access={access}
      />
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "admin failed");
    return (
      <article className="state-box error">
        <h2>Keys didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
