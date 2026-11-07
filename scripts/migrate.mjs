import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);
const source = readFileSync(new URL("./migrate.sql", import.meta.url), "utf8");
const statements = source
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Applied ${statements.length} statements.`);
