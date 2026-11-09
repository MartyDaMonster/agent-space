import pg from "pg";
import { neon } from "@neondatabase/serverless";

let sqlClient;

export function resetSqlCache() {
  const current = sqlClient;
  sqlClient = null;
  if (current?.pool) current.pool.end().catch(() => {});
}

export function createSql(url = process.env.DATABASE_URL) {
  if (!url) {
    const error = new Error("DATABASE_URL is not set.");
    error.code = "NO_DATABASE";
    throw error;
  }
  if (process.env.SQL_DRIVER === "pg") return pgSql(url);
  return neon(url);
}

export function getSql() {
  if (!sqlClient) sqlClient = createSql();
  return sqlClient;
}

function pgSql(url) {
  const pool = new pg.Pool({ connectionString: url, max: 8 });
  const sql = async (strings, ...values) => {
    const text = strings.reduce((query, part, index) => (
      query + part + (index < values.length ? `$${index + 1}` : "")
    ), "");
    const result = await pool.query(text, values);
    return result.rows;
  };
  sql.query = async (statement) => {
    const result = await pool.query(statement);
    return result.rows;
  };
  sql.pool = pool;
  return sql;
}
