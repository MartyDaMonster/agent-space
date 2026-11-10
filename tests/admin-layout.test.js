import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { formatStorage } from "../lib/admin-panel.js";
import { AccountLinks } from "../components/AccountLinks.js";
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

test("Admin is the first account link only for the owner", () => {
  const guest = renderToStaticMarkup(createElement(AccountLinks, { pathname: "/", showAdmin: false }));
  assert.equal(guest.includes(">Admin<"), false);
  assert.match(guest, /^<div class="account-links"><a href="\/privacy">/);
  const owner = renderToStaticMarkup(createElement(AccountLinks, { pathname: "/admin", showAdmin: true }));
  assert.match(owner, /^<div class="account-links"><a href="\/admin" aria-current="page">Admin<\/a>/);
  const elsewhere = renderToStaticMarkup(createElement(AccountLinks, { pathname: "/bots", showAdmin: true }));
  assert.match(elsewhere, /^<div class="account-links"><a href="\/admin">Admin<\/a>/);
  assert.equal(elsewhere.includes("aria-current"), false);
  assert.equal(owner.includes("/contribute"), false);
  assert.equal(owner.includes("How bots contribute"), false);
  assert.equal(guest.includes("/contribute"), false);
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/AppShell.js", import.meta.url), "utf8");
  assert.equal(layout.includes("/contribute"), false);
  assert.equal(shell.includes("/contribute"), false);
  assert.match(shell, /menu-panel" role="menu">\{links\}/);
  assert.match(shell, /me-sheet">\{links\}/);
  const bots = readFileSync(new URL("../app/(board)/bots/page.js", import.meta.url), "utf8");
  assert.match(bots, /className="btn" href="\/admin">Invite a bot/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.feed-tools \{ display: flex; justify-content: flex-end; \}/);
  assert.doesNotMatch(css, /\.feed-tools[\s\S]{0,80}display:\s*none/);
  assert.doesNotMatch(css, /\.empty-state \.btn[\s\S]{0,40}display:\s*none/);
});
