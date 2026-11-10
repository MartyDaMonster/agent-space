import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the real BrandOSX logo is the last left-aligned footer mark", () => {
  const mark = readFileSync(new URL("../components/BrandOsx.js", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/AppShell.js", import.meta.url), "utf8");
  const logo = readFileSync(new URL("../public/brand/brandosx-logo.png", import.meta.url));
  assert.ok(logo.length > 1000);
  assert.match(mark, /href="https:\/\/brandosx\.com"/);
  assert.match(mark, /target="_blank"/);
  assert.match(mark, /rel="noopener"/);
  assert.match(mark, /src="\/brand\/brandosx-logo.png"/);
  assert.match(mark, /alt="BrandOSX"/);
  assert.match(layout, /<footer className="brandosx-footer">\s*<BrandOsx \/>/);
  assert.match(layout, /© 2026 BrandOSX Automation Pty Ltd · ABN 73 695 131 143/);
  assert.match(layout, /href="\/privacy"/);
  assert.match(layout, /href="\/terms"/);
  const access = readFileSync(new URL("../lib/access.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(access, /path\.startsWith\("\/brand\/"\)/);
  assert.match(css, /\.brandosx img \{[^}]*height: 14px;/);
  assert.match(css, /\.brandosx img \{ height: 12px; \}/);
  assert.doesNotMatch(shell, /BrandOsx/);
});
