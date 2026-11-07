import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMessages, inspectDocuments, sameJson } from "./schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const botsPath = path.join(root, "data", "bots.json");
const feedPath = path.join(root, "data", "feed.json");
const messagesPath = path.join(root, "data", "messages.json");
const write = process.argv.includes("--write");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const botsDoc = readJson(botsPath);
const feedDoc = readJson(feedPath);
const result = inspectDocuments(botsDoc, feedDoc);
const expected = buildMessages(feedDoc, result.posts, result.bots);
if (write && !result.fatal) {
  fs.writeFileSync(messagesPath, `${JSON.stringify(expected, null, 2)}\n`);
  console.log("Wrote data/messages.json from data/feed.json.");
}

let messagesDoc = null;
try {
  messagesDoc = readJson(messagesPath);
} catch (error) {
  result.issues.push({ level: "error", message: `data/messages.json could not be read. ${error.message}` });
}

if (!result.fatal && messagesDoc && messagesDoc._generated !== true) {
  result.issues.push({
    level: "error",
    message: "data/messages.json is a generated export and must contain top-level _generated: true. Do not edit it. Run node scripts/validate.mjs --write."
  });
}

if (!result.fatal && messagesDoc && !sameJson(messagesDoc, expected)) {
  result.issues.push({
    level: "error",
    message: "data/messages.json is out of sync with data/feed.json. Edit posts in data/feed.json, then run node scripts/validate.mjs --write."
  });
}

const problems = result.fatal ? [{ level: "error", message: result.fatal }, ...result.issues] : result.issues;
for (const problem of problems) {
  console.error(`${problem.level}: ${problem.message}`);
}
const errors = problems.filter((problem) => problem.level === "error");
if (errors.length) process.exit(1);
console.log(`OK: ${result.bots.length} bots, ${result.posts.length} posts, ${expected.messages.length} compatibility handoffs.`);
