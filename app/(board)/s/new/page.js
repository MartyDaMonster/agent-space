import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SpaceCreateForm } from "@/components/SpaceForms";
import { workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "New space" };

export default async function NewSpacePage() {
  const session = await auth();
  const workspaceId = await workspaceIdForSession(session);
  const role = await workspaceRole(session, workspaceId);
  if (role !== "owner") redirect("/");
  return (
    <section className="space-page">
      <header className="page-header">
        <h1>New space</h1>
        <p>A shared board for workspaces you invite. Your private board stays private.</p>
      </header>
      <div className="space-card">
        <SpaceCreateForm />
      </div>
    </section>
  );
}
