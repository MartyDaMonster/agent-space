import assert from "node:assert/strict";
import test from "node:test";
import { decideAccess } from "../lib/access.js";
import {
  QUOTA_MESSAGE,
  WORKSPACE_QUOTA_BYTES,
  fileAccess,
  inspectUpload,
  quotaDecision,
  storageChoice,
  storageReport,
  usageLabel
} from "../lib/file-rules.js";

test("only the allowed file types can be attached", () => {
  assert.equal(inspectUpload({ name: "notes.md", size: 12 }).ok, true);
  assert.equal(inspectUpload({ name: "photo.JPEG", size: 12 }).extension, "jpg");
  assert.equal(inspectUpload({ name: "virus.exe", size: 12 }).status, 415);
  assert.equal(inspectUpload({ name: "big.pdf", size: 10 * 1024 * 1024 + 1 }).status, 413);
});

test("a workspace stops at 100MB", () => {
  const near = quotaDecision({ usedBytes: WORKSPACE_QUOTA_BYTES - 10, incomingBytes: 11 });
  assert.equal(near.ok, false);
  assert.equal(near.status, 413);
  assert.equal(near.error, QUOTA_MESSAGE);
  assert.equal(usageLabel(42 * 1024 * 1024), "42MB of 100MB");
  assert.equal(quotaDecision({ usedBytes: 1000, incomingBytes: 1000 }).ok, true);
});

test("files over 4MB need the private store", () => {
  assert.equal(storageChoice({ size: 5 * 1024 * 1024, hasBlob: false }).status, 413);
  assert.equal(storageChoice({ size: 5 * 1024 * 1024, hasBlob: true }).storage, "blob");
  assert.equal(storageChoice({ size: 1000, hasBlob: false }).storage, "neon");
});

test("another workspace cannot tell that a file exists", () => {
  const file = { workspaceId: "ws-ada" };
  assert.equal(fileAccess({ anonymous: true, file, actorWorkspace: "" }).status, 401);
  assert.equal(fileAccess({ file, actorWorkspace: "ws-martin" }).status, 404);
  assert.equal(fileAccess({ file, actorWorkspace: "ws-ada" }).ok, true);
  assert.equal(decideAccess({ pathname: "/api/files", hasSession: false }).status, 401);
  assert.equal(decideAccess({ pathname: "/api/files/file_x", hasSession: false, authorization: "Bearer btm" }).bearer, true);
  assert.equal(decideAccess({ pathname: "/api/cron/expire-files", hasSession: false }).ok, true);
});

test("daily storage reports the workspace and the overall total", () => {
  assert.deepEqual(storageReport({
    workspaceBytes: 10,
    workspaceFiles: 1,
    overallBytes: 30,
    overallFiles: 2
  }), {
    bytes: 10,
    files: 1,
    overallBytes: 30,
    overallFiles: 2
  });
});
