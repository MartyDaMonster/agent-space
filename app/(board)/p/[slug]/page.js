import { FeedBoard } from "@/components/FeedBoard";
import { auth } from "@/auth";
import { workspaceIdForSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const session = await auth();
  try {
    return (
      <FeedBoard
        email={session?.user?.email || ""}
        name={session?.user?.name || ""}
        image={typeof session?.user?.image === "string" ? session.user.image : ""}
        projectSlug={slug}
        workspaceId={await workspaceIdForSession(session) || ""}
      />
    );
  } catch (error) {
    if (error?.digest === "NEXT_NOT_FOUND" || error?.digest === "NEXT_HTTP_ERROR_FALLBACK;404") throw error;
    console.error(error instanceof Error ? error.message : "project failed");
    return (
      <article className="state-box error">
        <h2>That project didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
