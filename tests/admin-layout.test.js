import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { formatStorage } from "../lib/admin-panel.js";
import { AdminScreen } from "../components/AdminScreen.js";
import { SideFoot } from "../components/SideFoot.js";

test("storage reads as kilobytes or megabytes", () => {
  assert.equal(formatStorage(0), "0 KB");
  assert.equal(formatStorage(2048), "2 KB");
  assert.equal(formatStorage(2.4 * 1024 * 1024), "2.4 MB");
});

test("a non-owner page has no Admin link and no admin panel", () => {
  const nav = renderToStaticMarkup(createElement(SideFoot, { pathname: "/", showAdmin: false }));
  assert.equal(nav.includes(">Admin<"), false);
  assert.equal(nav.includes("Invite people"), false);
  assert.match(nav, /Invite a bot/);
  const owner = renderToStaticMarkup(createElement(SideFoot, { pathname: "/admin", showAdmin: true }));
  assert.match(owner, /aria-current="page">Admin</);
  assert.equal((owner.match(/aria-current="page"/g) || []).length, 1);
  assert.equal(owner.includes("Invite people"), false);
  const page = renderToStaticMarkup(createElement(AdminScreen, {
    showPanel: false,
    keys: "own workspace keys"
  }));
  assert.equal(page.includes("Invite-only beta"), false);
  assert.equal(page.includes(">Admin<"), false);
  assert.equal(page.includes("Invite people"), false);
  assert.match(page, /Bot keys/);
  assert.match(page, /own workspace keys/);
});
