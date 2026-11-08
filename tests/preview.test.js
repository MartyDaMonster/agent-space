import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { inspectLink, isBlockedAddress, isBlockedHost } from "../lib/compose.js";
import { fetchPinned, pinLookup, readPageTitle } from "../lib/page-title.js";

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

test("the connection is pinned to the address that passed validation", async () => {
  const answers = {
    "example.com": ["93.184.216.34", "10.1.1.1"],
    "cdn.example": ["1.1.1.1"]
  };
  const counts = {};
  const connected = [];
  const title = await readPageTitle("https://example.com/start", {
    lookup: async (host) => {
      const list = answers[host] || ["10.0.0.1"];
      const index = counts[host] || 0;
      counts[host] = index + 1;
      return [{ address: list[index] || "10.0.0.1", family: 4 }];
    },
    fetch: async (url, options) => {
      const pinned = await new Promise((resolve, reject) => {
        pinLookup(options.address)("rebind.invalid", (error, address) => {
          if (error) reject(error);
          else resolve(address);
        });
      });
      connected.push({
        url: String(url),
        host: new URL(url).hostname,
        headerHost: options.headers.host,
        pinned
      });
      if (String(url).endsWith("/start")) {
        return new Response("", { status: 302, headers: { location: "https://cdn.example/next" } });
      }
      return new Response("<title>Pinned</title>");
    }
  });
  assert.equal(title, "Pinned");
  assert.equal(counts["example.com"], 1);
  assert.deepEqual(connected, [
    { url: "https://example.com/start", host: "example.com", headerHost: "example.com", pinned: "93.184.216.34" },
    { url: "https://cdn.example/next", host: "cdn.example", headerHost: "cdn.example", pinned: "1.1.1.1" }
  ]);
});

test("the pinned request keeps the hostname for SNI and the certificate check", async () => {
  const seen = [];
  const body = Readable.from([Buffer.from("<title>Direct</title>")]);
  body.statusCode = 200;
  body.headers = { "content-type": "text/html" };
  const title = await new Promise((resolve, reject) => {
    fetchPinned("https://example.com/start", {
      address: "93.184.216.34",
      request(options, callback) {
        seen.push(options);
        callback(body);
        return { on() {}, end() {} };
      }
    }).then(async (response) => resolve(await response.text())).catch(reject);
  });
  assert.equal(title, "<title>Direct</title>");
  assert.equal(seen[0].hostname, "example.com");
  assert.equal(seen[0].servername, "example.com");
  assert.equal(seen[0].headers.host, "example.com");
  assert.equal(seen[0].rejectUnauthorized, true);
  const pinned = await new Promise((resolve) => {
    seen[0].lookup("this-name-is-ignored.example", (error, address) => resolve(address));
  });
  assert.equal(pinned, "93.184.216.34");
  const v6 = await new Promise((resolve) => {
    pinLookup("2001:4860:4860::8888")("example.com", (error, address, family) => resolve({ address, family }));
  });
  assert.deepEqual(v6, { address: "2001:4860:4860::8888", family: 6 });
});

test("pinLookup returns an address list when Node sets all: true", async () => {
  const records = await new Promise((resolve, reject) => {
    pinLookup("93.184.216.34")("example.com", { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });
  assert.deepEqual(records, [{ address: "93.184.216.34", family: 4 }]);
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
