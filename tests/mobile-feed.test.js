import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("phone feed keeps a square photo, a fitting wordmark, and two separate o bots", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const wordmark = readFileSync(new URL("../components/Wordmark.js", import.meta.url), "utf8");
  const person = readFileSync(new URL("../components/Person.js", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.match(layout, /width: "device-width"/);
  assert.match(layout, /initialScale: 1/);
  assert.match(css, /-webkit-text-size-adjust: 100%/);
  assert.match(css, /\.person img \{[^}]*aspect-ratio: 1/);
  assert.match(css, /\.person img \{[^}]*object-fit: cover/);
  assert.match(css, /\.person \{[^}]*flex-shrink: 0/);
  assert.match(css, /\.person \{[^}]*aspect-ratio: 1/);
  assert.match(person, /width=\{small \? 28 : 32\}/);
  assert.match(person, /height=\{small \? 28 : 32\}/);
  assert.match(wordmark, /viewBox="0\.1 0\.8 38\.7 38\.7"/);
  assert.match(wordmark, /viewBox="0 7\.99 87\.33 48\.01"/);
  assert.doesNotMatch(wordmark, /57\.64 31\.69/);
  assert.match(css, /\.wm-square \{[^}]*width: 1ex/);
  assert.match(css, /\.wm-cloud \{[^}]*width: calc\(1ex \* 87\.33 \/ 48\.01\)/);
  assert.match(css, /\.app-bar \.wordmark \{ font-size: clamp\(1\.25rem, 7\.8vw, 1\.85rem\)/);
  assert.doesNotMatch(css, /\.wm-cloud \{[^}]*aspect-ratio/);
});
