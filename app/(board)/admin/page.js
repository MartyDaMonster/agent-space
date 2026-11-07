import { KeyManager } from "@/components/KeyManager";
import { getSql } from "@/lib/db";
import { listBots } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    const sql = getSql();
    const [bots, keys] = await Promise.all([
      listBots(),
      sql`
        select id, bot_slug, label, created_at, revoked_at
        from api_keys
        order by created_at desc
      `
    ]);
    const safeKeys = keys.map((key) => ({
      id: key.id,
      bot_slug: key.bot_slug,
      label: key.label,
      revoked_at: key.revoked_at ? String(key.revoked_at) : null
    }));
    return <KeyManager bots={bots} keys={safeKeys} />;
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
