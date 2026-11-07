import { PostCard } from "@/components/PostCard";
import { listBots, listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const [posts, bots] = await Promise.all([listPosts({ limit: 50 }), listBots()]);
    return (
      <section className="feed" aria-label="Feed">
        {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} bots={bots} />) : (
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
