import { saveAssistantChoice } from "@/lib/stage2-store";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { inviteId } = await params;
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
