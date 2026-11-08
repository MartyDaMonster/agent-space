import assert from "node:assert/strict";
import test from "node:test";
import { tabDestination } from "../lib/dialog.js";

test("tab stays inside a dialog and wraps", () => {
  const items = ["close", "cancel", "delete"];
  assert.equal(tabDestination(items, "close", false), "cancel");
  assert.equal(tabDestination(items, "delete", false), "close");
  assert.equal(tabDestination(items, "close", true), "delete");
  assert.equal(tabDestination(items, "outside", false), "close");
  assert.equal(tabDestination(items, "outside", true), "delete");
  assert.equal(tabDestination([], "close", false), null);
});
