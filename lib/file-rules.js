const TYPES = {
  md: "text/markdown",
  txt: "text/plain",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  csv: "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip"
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DB_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 10;
const FILE_ID = /^f_[A-Za-z0-9_-]{20,80}$/;

export function privateBlobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function fileExt(name) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (!TYPES[ext]) return "";
  return ext === "jpeg" ? "jpg" : ext;
}

export function contentTypeFor(ext) {
  if (ext === "jpg") return TYPES.jpg;
  return TYPES[ext] || "";
}

export function cleanFileName(name) {
  const base = String(name || "").split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").replace(/^\.+/, "").trim();
  if (!cleaned || cleaned.length > 180 || !fileExt(cleaned)) return null;
  return cleaned;
}

export function isFileId(id) {
  return FILE_ID.test(String(id || ""));
}

export function fileHref(id) {
  return isFileId(id) ? `/api/files/${id}` : "";
}

export function readFileIds(value) {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const ids = [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
  if (ids.length > MAX_FILES) return { ok: false, error: "Attach up to 10 files." };
  if (ids.some((id) => !isFileId(id))) return { ok: false, error: "A file id is not valid." };
  return { ok: true, ids };
}

export function newFileId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let text = "";
  for (const byte of bytes) text += byte.toString(16).padStart(2, "0");
  return `f_${text}`;
}

export function publicFile(row) {
  return {
    id: row.id,
    name: row.name,
    contentType: row.content_type || row.contentType,
    size: Number(row.size_bytes ?? row.size)
  };
}

export function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  const mb = size / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function contentDisposition(name, contentType) {
  const inline = String(contentType || "").startsWith("image/");
  const ascii = String(name || "file").replace(/[^\w.\- ]+/g, "") || "file";
  const star = encodeURIComponent(String(name || "file"));
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${star}`;
}

function startsWith(view, text, offset = 0) {
  for (let i = 0; i < text.length; i += 1) {
    if (view[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function hasNull(view) {
  for (let i = 0; i < view.length; i += 1) if (view[i] === 0) return false;
  return true;
}

export function bytesMatchKind(ext, bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!view.length) return false;
  if (ext === "png") return view[0] === 0x89 && startsWith(view, "PNG", 1);
  if (ext === "jpg") return view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff;
  if (ext === "gif") return startsWith(view, "GIF8");
  if (ext === "webp") return startsWith(view, "RIFF") && startsWith(view, "WEBP", 8);
  if (ext === "pdf") return startsWith(view, "%PDF");
  if (ext === "zip" || ext === "docx" || ext === "xlsx" || ext === "pptx") return view[0] === 0x50 && view[1] === 0x4b;
  if (ext === "json") {
    try {
      JSON.parse(new TextDecoder().decode(view));
      return true;
    } catch {
      return false;
    }
  }
  if (ext === "md" || ext === "txt" || ext === "csv") return hasNull(view);
  return false;
}

export function checkFile({ name, bytes }) {
  const cleaned = cleanFileName(name);
  if (!cleaned) return { ok: false, error: "Use a file named with md, txt, pdf, png, jpg, webp, gif, csv, json, docx, xlsx, pptx, or zip." };
  const ext = fileExt(cleaned);
  const size = bytes?.byteLength ?? bytes?.length ?? 0;
  const limit = privateBlobEnabled() ? MAX_FILE_BYTES : MAX_DB_BYTES;
  if (!size) return { ok: false, error: "That file is empty." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "A file must be 10MB or smaller." };
  if (size > limit) return { ok: false, error: "Without private file storage, a file must be 4MB or smaller." };
  if (!bytesMatchKind(ext, bytes)) return { ok: false, error: "That file does not match its type." };
  return { ok: true, name: cleaned, ext, contentType: contentTypeFor(ext), size };
}
