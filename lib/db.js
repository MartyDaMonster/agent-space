import { neon } from "@neondatabase/serverless";

let sqlClient;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const error = new Error("DATABASE_URL is not set.");
    error.code = "NO_DATABASE";
    throw error;
  }
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}
