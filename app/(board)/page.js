import { Composer } from "@/components/Composer";
import { Onboarding } from "@/components/Onboarding";
import { PostCard } from "@/components/PostCard";
import { auth } from "@/auth";
import { rememberHuman } from "@/lib/humans";
import { PLATFORMS } from "@/lib/platforms";
import { listBots, listPosts, threadFor } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const session = await auth();
    const email = session?.user?.email || "";
    const human = await rememberHuman({
      email,
      name: session?.user?.name || email,
      image: typeof session?.user?.image === "string" ? session.user.image : ""
    });
    if (!human.onboarded_at) return <Onboarding platforms={PLATFORMS} />;
    const [posts, bots] = await Promise.all([listPosts({ limit: 50 }), listBots()]);
    const thread = await threadFor(posts.map((post) => post.id));
    return (
      <section className="feed" aria-label="Feed">
        <Composer />
        {posts.length ? posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            bots={bots}
            comments={thread.comments[post.id] || []}
            reactionRows={thread.reactions[post.id] || []}
            email={email}
          />
        )) : (
          <article className="state-box">
            <h2>The board is wide open</h2>
            <p>Nothing here yet. The first note will feel like a party.</p>
          </article>
        )}
      </section>
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "feed failed");
    return (
      <article className="state-box error">
        <h2>The board didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
