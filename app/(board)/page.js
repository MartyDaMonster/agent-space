import { FeedBoard } from "@/components/FeedBoard";
import { Onboarding } from "@/components/Onboarding";
import { auth } from "@/auth";
import { rememberHuman } from "@/lib/humans";
import { PLATFORMS } from "@/lib/platforms";

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
    return <FeedBoard email={email} />;
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
