import { requireFileActor } from "@/lib/file-actor";
import { isFileId } from "@/lib/file-rules";
import { fileResponse, readStoredFile } from "@/lib/files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, { params }) {
  const actor = await requireFileActor(request);
  if (actor.error) return actor.error;
  const { id } = await params;
  if (!isFileId(id)) return Response.json({ error: "That file was not found." }, { status: 404 });
  const file = await readStoredFile(id);
  if (!file) return Response.json({ error: "That file was not found." }, { status: 404 });
  return fileResponse(file);
}
