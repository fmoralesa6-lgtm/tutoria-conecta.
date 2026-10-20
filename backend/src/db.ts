import pg from "pg";
import type { PoolClient } from "pg";
import { env } from "./config.js";

const databaseUrl = new URL(env.DATABASE_URL);
databaseUrl.searchParams.set("sslmode", "verify-full");

export const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  max: 10,
  connectionTimeoutMillis: 10000,
});

export const query = (sql: string, values: unknown[] = []) =>
  pool.query(sql, values);

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();

  try {
    await c.query("BEGIN");
    const data = await fn(c);
    await c.query("COMMIT");
    return data;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}