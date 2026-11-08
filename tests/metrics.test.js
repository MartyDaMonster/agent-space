import assert from "node:assert/strict";
import test from "node:test";
import { takeOnce, videoRatio } from "../lib/metric-events.js";
import {
  dailyAccess,
  ipRateKey,
  isObviousBot,
  parseDays,
  prepareMetric,
  referrerDomain,
  reportWindow,
  sameSiteOrigin,
  summarizeDaily,
  sydneyDate,
  visitorHash,
  zonedMidnight
} from "../lib/metrics.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SALT = "test-salt";

test("Sydney dates follow Australia/Sydney, including the UTC date change", () => {
  assert.equal(sydneyDate(new Date("2026-11-07T12:59:00Z")), "2026-11-07");
  assert.equal(sydneyDate(new Date("2026-11-07T13:00:00Z")), "2026-11-08");
  assert.equal(zonedMidnight("2026-11-08").toISOString(), "2026-11-07T13:00:00.000Z");
  assert.equal(zonedMidnight("2026-07-01").toISOString(), "2026-06-30T14:00:00.000Z");
});

test("a visitor hash is daily, salted, and does not contain the IP", () => {
  const shared = { ip: "203.0.113.8", userAgent: CHROME, salt: SALT };
  const morning = visitorHash({ ...shared, day: "2026-11-08" });
  const later = visitorHash({ ...shared, day: "2026-11-08" });
  const nextDay = visitorHash({ ...shared, day: "2026-11-09" });
  const otherIp = visitorHash({ ...shared, ip: "203.0.113.9", day: "2026-11-08" });
  assert.equal(morning, later);
  assert.notEqual(morning, nextDay);
  assert.notEqual(morning, otherIp);
  assert.match(morning, /^[a-f0-9]{64}$/);
  assert.equal(morning.includes("203.0.113.8"), false);
  assert.equal(ipRateKey("203.0.113.8", SALT).includes("203.0.113.8"), false);
});

test("obvious bots are ignored and a normal browser is counted", () => {
  assert.equal(isObviousBot(""), true);
  assert.equal(isObviousBot("curl/8.5.0"), true);
  assert.equal(isObviousBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isObviousBot(CHROME), false);
  const ignored = prepareMetric({
    type: "login_view",
    referrer: "https://www.linkedin.com/in/marty",
    ip: "203.0.113.8",
    userAgent: "curl/8.5.0",
    salt: SALT
  });
  assert.equal(ignored.ignore, true);
  assert.equal(ignored.event, undefined);
});

test("a login view keeps a referrer domain and drops the path", () => {
  assert.equal(referrerDomain("https://www.LinkedIn.com/in/marty?trk=1"), "linkedin.com");
  assert.equal(referrerDomain("https://botomatic.dev/login", { selfHosts: ["botomatic.dev"] }), null);
  assert.equal(referrerDomain("javascript:alert(1)"), null);
  const prepared = prepareMetric({
    type: "login_view",
    referrer: "https://www.linkedin.com/in/martyhungerford",
    ip: "203.0.113.8",
    userAgent: CHROME,
    now: new Date("2026-11-07T20:00:00Z"),
    salt: SALT,
    selfHosts: ["botomatic.dev"]
  });
  assert.equal(prepared.event.referrer, "linkedin.com");
  assert.equal(prepared.event.visitorHash.includes("203.0.113.8"), false);
  assert.equal(prepared.event.createdAt, "2026-11-07T20:00:00Z");
  const play = prepareMetric({
    type: "video_play",
    referrer: "https://www.linkedin.com/in/marty",
    ip: "203.0.113.8",
    userAgent: CHROME,
    salt: SALT
  });
  assert.equal(play.event.referrer, null);
  assert.equal(prepareMetric({ type: "nope", userAgent: CHROME, salt: SALT }).error, "bad_type");
});

test("the daily report uses Sydney days, uniques, video counts, and top referrers", () => {
  const now = new Date("2026-11-08T02:00:00Z");
  const window = reportWindow(2, now);
  assert.deepEqual(window.dates, ["2026-11-07", "2026-11-08"]);
  const hashA = visitorHash({ ip: "203.0.113.8", userAgent: CHROME, day: "2026-11-08", salt: SALT });
  const hashB = visitorHash({ ip: "198.51.100.4", userAgent: CHROME, day: "2026-11-08", salt: SALT });
  const report = summarizeDaily([
    { type: "login_view", createdAt: "2026-11-07T13:30:00Z", visitorHash: hashA, referrer: "linkedin.com" },
    { type: "login_view", createdAt: "2026-11-07T18:00:00Z", visitorHash: hashA, referrer: "linkedin.com" },
    { type: "login_view", createdAt: "2026-11-07T19:00:00Z", visitorHash: hashB, referrer: "x.com" },
    { type: "video_play", createdAt: "2026-11-07T19:05:00Z", visitorHash: hashA, referrer: "should-not-count.example" },
    { type: "video_complete", createdAt: "2026-11-07T19:10:00Z", visitorHash: hashA, referrer: null },
    { type: "login_view", createdAt: "2026-11-06T10:00:00Z", visitorHash: "yesterday", referrer: "old.example" }
  ], { days: 2, now });
  assert.equal(report.timezone, "Australia/Sydney");
  assert.deepEqual(report.days[0], {
    date: "2026-11-07",
    views: 0,
    uniqueVisitors: 0,
    videoPlays: 0,
    videoCompletes: 0,
    referrers: []
  });
  assert.equal(report.days[1].date, "2026-11-08");
  assert.equal(report.days[1].views, 3);
  assert.equal(report.days[1].uniqueVisitors, 2);
  assert.equal(report.days[1].videoPlays, 1);
  assert.equal(report.days[1].videoCompletes, 1);
  assert.deepEqual(report.days[1].referrers, [
    { domain: "linkedin.com", views: 2 },
    { domain: "x.com", views: 1 }
  ]);
});

test("the daily read is a bot key or an invited session", () => {
  assert.deepEqual(dailyAccess({ authorization: "Bearer btm_test", bearerValid: true, invited: false }), { ok: true });
  assert.deepEqual(dailyAccess({ authorization: "Bearer btm_nope", bearerValid: false, invited: true }), { ok: false, status: 401 });
  assert.deepEqual(dailyAccess({ authorization: "", bearerValid: false, invited: true }), { ok: true });
  assert.deepEqual(dailyAccess({ authorization: "", bearerValid: false, invited: false }), { ok: false, status: 401 });
  assert.equal(parseDays(null), 14);
  assert.equal(parseDays("7"), 7);
  assert.equal(parseDays("0"), null);
  assert.equal(parseDays("91"), null);
  assert.equal(parseDays("1.5"), null);
  assert.equal(sameSiteOrigin("https://botomatic.dev", "botomatic.dev"), true);
  assert.equal(sameSiteOrigin("https://evil.example", "botomatic.dev"), false);
  assert.equal(sameSiteOrigin(null, "botomatic.dev"), true);
});

test("a page load records one view, the first play, and one complete at 90 percent", () => {
  const seen = {};
  assert.equal(takeOnce(seen, "login_view"), true);
  assert.equal(takeOnce(seen, "login_view"), false);
  assert.equal(takeOnce(seen, "video_play"), true);
  assert.equal(takeOnce(seen, "video_play"), false);
  assert.equal(videoRatio(89, 100) >= 0.9, false);
  assert.equal(videoRatio(90, 100) >= 0.9, true);
  assert.equal(videoRatio(10, 0) >= 0.9, false);
  assert.equal(takeOnce(seen, "video_complete"), true);
  assert.equal(takeOnce(seen, "video_complete"), false);
});
