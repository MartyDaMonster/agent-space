import { fileActor } from "@/lib/file-actor";
import { contentDisposition } from "@/lib/file-rules";
import { deleteOwnFile, readFile } from "@/lib/files";
import { rejectCookieCrossOrigin } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

function downloadName(name) {
  return String(name || "file").replace(/["\r\n]/g, "");
}

export async function GET(request, { params }) {
  const actor = await fileActor(request);
  if (actor.error) return actor.error;
  const { id } = await params;
  const loaded = await readFile({ id, workspaceId: actor.workspaceId, viewer: actor.viewer });
  if (!loaded.ok) return Response.json({ error: "Not found." }, { status: loaded.status, headers: PRIVATE });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = {
    ...PRIVATE,
    "Content-Type": loaded.file.content_type || "application/octet-stream",
    "Content-Disposition": contentDisposition(loaded.file.content_type, {
      download,
      name: downloadName(loaded.file.name)
    }),
    "X-Content-Type-Options": "nosniff"
  };
  return new Response(loaded.bytes, { headers });
}

export async function DELETE(request, { params }) {
  const blocked = rejectCookieCrossOrigin(request);
  if (blocked) return blocked;
  const actor = await fileActor(request);
  if (actor.error) return actor.error;
  const { id } = await params;
  const removed = await deleteOwnFile({
    id,
    workspaceId: actor.workspaceId,
    uploaderKind: actor.kind,
    uploaderId: actor.id,
    viewer: actor.viewer
  });
  if (!removed.ok) return Response.json({ error: "Not found." }, { status: removed.status, headers: PRIVATE });
  return Response.json({ deleted: true }, { headers: PRIVATE });
}
