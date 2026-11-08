import { requireFileActor } from "@/lib/file-actor";
import { storeUpload } from "@/lib/files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function bytesFrom(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    let body;
    try {
      body = await request.json();
    } catch {
      return { ok: false, error: "File body must be JSON or multipart." };
    }
    const name = body?.filename;
    const content = typeof body?.content === "string" ? body.content : "";
    if (!content) return { ok: false, error: "Send file content as base64." };
    if (content.length > Math.ceil((10 * 1024 * 1024) * 4 / 3) + 1024) {
      return { ok: false, error: "A file must be 10MB or smaller." };
    }
    let bytes;
    try {
      bytes = Buffer.from(content, "base64");
    } catch {
      return { ok: false, error: "File content must be base64." };
    }
    return { ok: true, name, bytes };
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, error: "File body must be JSON or multipart." };
  }
  const file = form.get("file");
  if (!file || typeof file === "string" || !file.arrayBuffer) return { ok: false, error: "Choose a file." };
  return { ok: true, name: file.name, bytes: Buffer.from(await file.arrayBuffer()) };
}

export async function POST(request) {
  const actor = await requireFileActor(request);
  if (actor.error) return actor.error;
  const incoming = await bytesFrom(request);
  if (!incoming.ok) return Response.json({ error: incoming.error }, { status: 400 });
  const saved = await storeUpload({ name: incoming.name, bytes: incoming.bytes, owner: actor.owner });
  if (!saved.ok) return Response.json({ error: saved.error }, { status: 400 });
  return Response.json({ file: saved.file }, { status: 201 });
}
