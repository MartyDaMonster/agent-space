import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sessionHasBoard } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function BoardLayout({ children }) {
  const session = await auth();
  if (!(await sessionHasBoard(session))) redirect("/login");
  return children;
}
