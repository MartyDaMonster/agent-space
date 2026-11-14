export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const NEON_MAX_BYTES = 4 * 1024 * 1024;
export const WORKSPACE_QUOTA_BYTES = 100 * 1024 * 1024;
export const FILE_TTL_DAYS = 30;
export const QUOTA_MESSAGE = "Workspace storage full (100MB). Delete old files to upload more.";

const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function contentDisposition(contentType, { download = false, name = "file" } = {}) {
  const safe = String(name || "file").replace(/["\r\n]/g, "") || "file";
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  const inline = !download && INLINE_TYPES.has(type);
  return `${inline ? "inline" : "attachment"}; filename="${safe}"`;
}

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

export function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return "";
  return match[1] === "jpeg" ? "jpg" : match[1];
}

export function safeFileName(name) {
  const base = String(name || "").split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim().slice(0, 180);
  return cleaned || "file";
}

export function inspectUpload({ name, size }) {
  const safe = safeFileName(name);
  const extension = fileExtension(safe);
  if (!extension || !TYPES[extension]) {
    return { ok: false, status: 415, error: "That file type is not allowed." };
  }
  if (!Number.isInteger(size) || size < 1) {
    return { ok: false, status: 400, error: "That file is empty." };
  }
  if (size > FILE_MAX_BYTES) {
    return { ok: false, status: 413, error: "Files must be 10MB or smaller." };
  }
  return { ok: true, name: safe, extension, contentType: TYPES[extension], size };
}

export function storageChoice({ size, hasBlob }) {
  if (hasBlob) return { ok: true, storage: "blob" };
  if (size <= NEON_MAX_BYTES) return { ok: true, storage: "neon" };
  return { ok: false, status: 413, error: "Files over 4MB need the private file store." };
}

export function quotaDecision({ usedBytes, incomingBytes }) {
  const used = Number(usedBytes) || 0;
  const incoming = Number(incomingBytes) || 0;
  if (used + incoming > WORKSPACE_QUOTA_BYTES) {
    return { ok: false, status: 413, error: QUOTA_MESSAGE };
  }
  return { ok: true, remaining: WORKSPACE_QUOTA_BYTES - used - incoming };
}

export function formatMegabytes(bytes) {
  const mb = Number(bytes) / (1024 * 1024);
  const rounded = Math.round(mb * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}MB`;
}

export function usageLabel(bytes) {
  return `${formatMegabytes(bytes)} of ${formatMegabytes(WORKSPACE_QUOTA_BYTES)}`;
}

export function storageReport({ workspaceBytes = 0, workspaceFiles = 0, overallBytes = 0, overallFiles = 0 } = {}) {
  return {
    bytes: Number(workspaceBytes) || 0,
    files: Number(workspaceFiles) || 0,
    overallBytes: Number(overallBytes) || 0,
    overallFiles: Number(overallFiles) || 0
  };
}

export function fileAccess({ anonymous = false, file = null, actorWorkspace = "", spaceMember = false } = {}) {
  if (anonymous) return { ok: false, status: 401 };
  if (!file) return { ok: false, status: 404 };
  if (file.spaceId) return spaceMember ? { ok: true } : { ok: false, status: 404 };
  if (file.workspaceId !== actorWorkspace) return { ok: false, status: 404 };
  return { ok: true };
}

export function acceptsExtensionList() {
  return Object.keys(TYPES).filter((ext) => ext !== "jpeg").map((ext) => `.${ext}`).join(",");
}
