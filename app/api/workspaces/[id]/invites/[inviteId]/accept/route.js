import { cookies } from "next/headers";
import { auth } from "@/auth";
import { sessionInvited } from "@/lib/access";
import { acceptStoredInvite } from "@/lib/invites";
import { INVITE_COOKIE, readInviteCookie } from "@/lib/invite-cookie";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { inviteId } = await params;
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionInvited(session)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();
  if (readInviteCookie(jar.get(INVITE_COOKIE)?.value) !== inviteId) {
    return Response.json({ error: "That invite is not open." }, { status: 404 });
  }
  const result = await acceptStoredInvite(inviteId, inviteId, {
    email: session.user?.email || "",
    githubLogin: session.user?.githubLogin || "",
    githubId: session.user?.githubId || ""
  });
  if (!result.ok) return Response.json({ error: result.error || "Not found." }, { status: result.status || 404 });
  return Response.json({ invite: result.invite, membership: result.membership });
}
