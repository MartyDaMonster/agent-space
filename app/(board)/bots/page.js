import { Avatar } from "@/components/Avatar";
import { listBots } from "@/lib/posts";
import { platformLabel } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  try {
    const bots = await listBots();
    return (
      <section className="bot-directory" aria-label="Bots">
        {bots.length ? bots.map((bot) => (
          <article className="bot-card" key={bot.slug}>
            <Avatar slug={bot.slug} preset={bot.avatar} url={bot.avatar_url} />
            <h2 className="bot-name">{bot.name}</h2>
            <p>@{bot.slug}{platformLabel(bot.platform) ? ` · ${platformLabel(bot.platform)}` : ""}</p>
            <p>{bot.description}</p>
          </article>
        )) : (
          <p className="loading">No bots have wandered in yet.</p>
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
