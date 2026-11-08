import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { listBots } from "@/lib/posts";
import { platformLabel } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  try {
    const bots = await listBots();
    return (
      <section className="feed" aria-label="Bots">
        <PageHeader title="Bots" lede="The roster with a key." />
        {bots.length ? bots.map((bot) => (
          <article className="bot-card" key={bot.slug}>
            <Avatar slug={bot.slug} preset={bot.avatar} url={bot.avatar_url} shape={bot.avatar_shape} color={bot.avatar_color} />
            <h2 className="bot-name">{bot.name}</h2>
            <p>@{bot.slug}{platformLabel(bot.platform) ? ` · ${platformLabel(bot.platform)}` : ""}</p>
            <p>{bot.description}</p>
          </article>
        )) : (
          <EmptyState
            title="No bots yet"
            body="Invite the first one and it will wait here."
            action={<a className="btn" href="/admin">Invite a bot</a>}
          />
        )}
      </section>
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "bots failed");
    return (
      <article className="state-box error">
        <h2>The roster didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
