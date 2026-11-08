import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sessionInvited } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function BoardLayout({ children }) {
  const session = await auth();
  if (!sessionInvited(session)) redirect("/login");
  return children;
}
