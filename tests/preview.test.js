import assert from "node:assert/strict";
import test from "node:test";
import { inspectLink, isBlockedAddress, isBlockedHost } from "../lib/compose.js";
import { readPageTitle } from "../lib/page-title.js";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("private IPv6 addresses are rejected", () => {
  for (const host of ["::1", "[::1]", "fd00::1", "[fd00::1]", "fc00::1", "fe80::1", "::ffff:7f00:1", "64:ff9b::a00:1"]) {
    assert.equal(isBlockedHost(host), true, host);
    assert.equal(isBlockedAddress(host.replace(/^\[|\]$/g, "")), true, host);
  }
  assert.equal(inspectLink("https://[fd00::1]/secret").ok, false);
  assert.equal(inspectLink("https://[::1]/").ok, false);
  assert.equal(inspectLink("https://[fe80::1]/local").ok, false);
  assert.equal(inspectLink("https://[::ffff:7f00:1]/meta").ok, false);
  assert.equal(isBlockedAddress("::ffff:a9fe:a9fe"), true);
  assert.equal(isBlockedHost("2001:4860:4860::8888"), false);
});

test("a redirect to a disallowed destination is not followed", async () => {
  const calls = [];
  const title = await readPageTitle("https://example.com/start", {
    lookup: publicLookup,
    fetch: async (url, options) => {
      calls.push({ url: String(url), redirect: options.redirect });
      return new Response("", {
        status: 302,
        headers: { location: "https://[fd00::1]/secret" }
      });
    }
  });
  assert.equal(title, "");
  assert.deepEqual(calls, [{ url: "https://example.com/start", redirect: "manual" }]);
});

test("a name that resolves to a private address is not fetched", async () => {
  let called = false;
  const title = await readPageTitle("https://example.com/rebind", {
    lookup: async () => [{ address: "fd12:3456::1", family: 6 }],
    fetch: async () => {
      called = true;
      return new Response("<title>nope</title>");
    }
  });
  assert.equal(title, "");
  assert.equal(called, false);
});

test("preview reading stops at the byte cap", async () => {
  let reads = 0;
  let cancelled = false;
  const chunk = new TextEncoder().encode(`<title>Capped</title>${"x".repeat(60000)}`);
  const body = new ReadableStream({
    pull(controller) {
      reads += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    }
  });
  const title = await readPageTitle("https://example.com/big", {
    lookup: publicLookup,
    fetch: async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } })
  });
  assert.equal(title, "Capped");
  assert.equal(cancelled, true);
  assert.equal(reads < 5, true);
});
