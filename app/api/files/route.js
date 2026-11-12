import { fileActor, uploadBytes } from "@/lib/file-actor";
import { createFile, workspaceUsage } from "@/lib/files";
import { rejectCookieCrossOrigin, rejectHumanUploadRate } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  const actor = await fileActor(request);
  if (actor.error) return actor.error;
  const usage = await workspaceUsage(actor.workspaceId);
  return Response.json({ usage }, { headers: PRIVATE });
}

export async function POST(request) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const actor = await fileActor(request);
  if (actor.error) return actor.error;
  const limited = rejectHumanUploadRate(actor);
  if (limited) return limited;
  const upload = await uploadBytes(request);
  if (!upload.ok) return Response.json({ error: upload.error }, { status: upload.status, headers: PRIVATE });
  const saved = await createFile({
    workspaceId: actor.workspaceId,
    uploaderKind: actor.kind,
    uploaderId: actor.id,
    name: upload.name,
    bytes: upload.bytes
  });
  if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status, headers: PRIVATE });
  return Response.json({ file: saved.file, usage: saved.usage }, { status: 201, headers: PRIVATE });
}
