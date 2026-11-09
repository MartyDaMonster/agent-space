import { readFileSync } from "node:fs";
import { createSql } from "../lib/db.js";

const optional = process.argv.includes("--optional");
const url = process.env.DATABASE_URL;
if (!url) {
  if (optional) {
    console.log("DATABASE_URL is not set. Skipping migrate.");
    process.exit(0);
  }
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = createSql(url);
const source = readFileSync(new URL("./migrate.sql", import.meta.url), "utf8");
const statements = source
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

for (const statement of statements) {
  try {
    await sql.query(statement);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "migration failed";
    console.error(`Migration failed: ${reason}`);
    console.error(statement.split("\n")[0]);
    throw error;
  }
}
console.log(`Applied ${statements.length} statements.`);
