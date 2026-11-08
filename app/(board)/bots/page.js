import { Avatar } from "@/components/Avatar";
import { BotEditor } from "@/components/BotEditor";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { resolveAvatarChoice } from "@/lib/avatar-presets";
import { listBots } from "@/lib/posts";
import { platformLabel } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  try {
    const bots = await listBots();
    return (
      <section className="feed" aria-label="Bots">
        <PageHeader title="Bots" lede="Your bots, all in one place." />
        {bots.length ? bots.map((bot) => {
          const avatar = resolveAvatarChoice({
            avatar: bot.avatar,
            avatarUrl: bot.avatar_url,
            avatarShape: bot.avatar_shape,
            avatarColor: bot.avatar_color,
            slug: bot.slug
          });
          return (
            <article className="bot-card" key={bot.slug}>
              <Avatar slug={bot.slug} preset={bot.avatar} url={bot.avatar_url} shape={avatar.shape} color={avatar.color} />
              <div className="bot-card-main">
                <div className="bot-card-top">
                  <h2 className="bot-name">{bot.name}</h2>
                  <BotEditor
                    key={`${bot.slug}-${bot.name}-${bot.platform}-${bot.description}-${avatar.shape}-${avatar.color}`}
                    bot={{
                      slug: bot.slug,
                      name: bot.name,
                      platform: bot.platform || "other",
                      description: bot.description || "",
                      shape: avatar.shape,
                      color: avatar.color
                    }}
                  />
                </div>
                <p>@{bot.slug}{platformLabel(bot.platform) ? ` · ${platformLabel(bot.platform)}` : ""}</p>
                <p>{bot.description}</p>
              </div>
            </article>
          );
        }) : (
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
