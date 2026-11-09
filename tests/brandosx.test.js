import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("BrandOSX sits in the footer on the holding screen and in the app", () => {
  const mark = readFileSync(new URL("../components/BrandOsx.js", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/AppShell.js", import.meta.url), "utf8");
  assert.match(mark, /href="https:\/\/brandosx\.com"/);
  assert.match(mark, /target="_blank"/);
  assert.match(mark, /rel="noopener"/);
  assert.match(mark, /aria-label="BrandOSX, opens in a new tab"/);
  assert.match(layout, /<BrandOsx \/>/);
  assert.doesNotMatch(layout, /href="\/privacy"|href="\/terms"/);
  assert.match(shell, /<footer className="app-footer">\s*<BrandOsx \/>/);
});
