import { auth } from "@/auth";
import { listPeople } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listPeople(await auth());
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ people: result.people });
}
