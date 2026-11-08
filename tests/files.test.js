import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FILE_BYTES,
  bytesMatchKind,
  checkFile,
  cleanFileName,
  contentDisposition,
  fileHref,
  isFileId,
  newFileId,
  publicFile,
  readFileIds
} from "../lib/file-rules.js";

test("file ids are unguessable and never become a blob address", () => {
  const id = newFileId();
  assert.equal(isFileId(id), true);
  assert.equal(fileHref(id), `/api/files/${id}`);
  assert.equal(fileHref("https://blob.vercel-storage.com/secret"), "");
  assert.notEqual(newFileId(), newFileId());
  const file = publicFile({
    id,
    name: "brief.md",
    content_type: "text/markdown",
    size_bytes: 20,
    blob_path: "files/secret",
    bytes: "hidden"
  });
  assert.deepEqual(file, { id, name: "brief.md", contentType: "text/markdown", size: 20 });
});

test("only the allowed file types pass, and downloads are not public links", () => {
  assert.equal(cleanFileName("../secrets.exe"), null);
  assert.equal(cleanFileName("brief.md"), "brief.md");
  const note = new TextEncoder().encode("# Brief\n\nHello.");
  assert.equal(checkFile({ name: "brief.md", bytes: note }).ok, true);
  assert.equal(checkFile({ name: "notes.txt", bytes: note }).ok, true);
  assert.equal(checkFile({ name: "data.json", bytes: new TextEncoder().encode("{\"ok\":true}") }).ok, true);
  assert.equal(checkFile({ name: "data.json", bytes: note }).ok, false);
  assert.equal(bytesMatchKind("png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])), true);
  assert.equal(bytesMatchKind("png", note), false);
  assert.match(checkFile({ name: "big.md", bytes: { byteLength: MAX_FILE_BYTES + 1 } }).error, /10MB/);
  assert.equal(readFileIds(["nope"]).ok, false);
  assert.equal(readFileIds([newFileId()]).ok, true);
  assert.match(contentDisposition("brief.md", "text/markdown"), /^attachment;/);
  assert.match(contentDisposition("photo.png", "image/png"), /^inline;/);
  assert.equal(contentDisposition("photo.png", "image/png").includes("http"), false);
});
