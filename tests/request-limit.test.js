import assert from "node:assert/strict";
import test from "node:test";
import { trustedClientIp } from "../lib/client-ip.js";
import { allowRate } from "../lib/request-limit.js";

test("a full rate-limit table drops the oldest key and keeps the one that was just used", () => {
  for (let i = 0; i < 5000; i += 1) {
    assert.equal(allowRate(`old-${i}`, 2, 60_000, 1_000), true);
  }
  assert.equal(allowRate("kept", 1, 60_000, 1_000), true);
  assert.equal(allowRate("kept", 1, 60_000, 1_001), false);
  assert.equal(allowRate("fresh", 1, 60_000, 1_002), true);
});

test("the client address prefers the platform IP over a caller-supplied forwarded list", () => {
  const headers = new Headers({
    "x-forwarded-for": "1.2.3.4, 203.0.113.8",
    "x-real-ip": "203.0.113.8"
  });
  assert.equal(trustedClientIp(headers), "203.0.113.8");
  assert.equal(trustedClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" })), "203.0.113.9");
});
