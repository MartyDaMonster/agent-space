import { cookies } from "next/headers";
import { INVITE_COOKIE, inviteCookieMatches } from "@/lib/invite-cookie";
import { rejectCookieCrossOrigin } from "@/lib/request-guard";
import { saveAssistantChoice } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const { inviteId } = await params;
  const jar = await cookies();
  if (!inviteCookieMatches(jar.get(INVITE_COOKIE)?.value, inviteId)) {
    return Response.json({ error: "That invite is not open." }, { status: 404 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const saved = await saveAssistantChoice(inviteId, body?.assistants || []);
  if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ assistants: saved.assistants });
}
