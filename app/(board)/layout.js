import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PausedAccess } from "@/components/PausedAccess";
import { boardAccess } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function BoardLayout({ children }) {
  const session = await auth();
  const access = await boardAccess(session);
  if (access === "paused") return <PausedAccess />;
  if (access !== "ok") redirect("/login");
  return children;
}
