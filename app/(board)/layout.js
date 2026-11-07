import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { emailAllowed } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function BoardLayout({ children }) {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!emailAllowed(email, process.env.ALLOWED_EMAILS)) redirect("/login");
  return children;
}
