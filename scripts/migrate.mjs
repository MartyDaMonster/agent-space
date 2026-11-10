import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createSql } from "../lib/db.js";
import { migrateOnThisDeploy } from "../lib/stage2.js";

export async function dropForeignKeysTo(sql, table) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected table.");
  let result;
  try {
    result = await sql.query(`
      select format('%I.%I', n.nspname, c.relname) as child,
             format('%I', con.conname) as name
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where con.contype = 'f' and con.confrelid = '${table}'::regclass
    `);
  } catch (error) {
    if (error?.code === "42P01") return;
    throw error;
  }
  const rows = Array.isArray(result) ? result : result?.rows || [];
  for (const row of rows) {
    await sql.query(`alter table ${row.child} drop constraint if exists ${row.name}`);
  }
}

async function applyStatements(sql, statements) {
  for (const statement of statements) {
    if (/drop constraint if exists (bots_pkey|posts_pkey|humans_pkey)/i.test(statement)) {
      const table = statement.match(/drop constraint if exists (bots|posts|humans)_pkey/i)[1];
      await dropForeignKeysTo(sql, table);
    }
    try {
      await sql.query(statement);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "migration failed";
      console.error(`Migration failed: ${reason}`);
      console.error(statement.split("\n")[0]);
      throw error;
    }
  }
}

async function main() {
  const optional = process.argv.includes("--optional");
  if (!migrateOnThisDeploy()) {
    console.log("Skipping schema changes on a Vercel preview. Production deploys apply them. Run npm run db:migrate to apply them on purpose.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (optional) {
      console.log("DATABASE_URL is not set. Skipping migrate.");
      return;
    }
    console.error("DATABASE_URL is not set.");
    process.exitCode = 1;
    return;
  }
  const sql = createSql(url);
  const source = readFileSync(new URL("./migrate.sql", import.meta.url), "utf8");
  const statements = source
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.startsWith("--"));
  await applyStatements(sql, statements);
  console.log(`Applied ${statements.length} statements.`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) await main();
