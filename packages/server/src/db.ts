import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Return DATE columns as "yyyy-MM-dd" strings, not JS Date objects.
// Without this, pg converts DATE → Date object → JSON gives "2026-04-06T00:00:00.000Z"
// which breaks <input type="date"> that expects "yyyy-MM-dd".
pg.types.setTypeParser(1082, (val: string) => val);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query("SELECT name FROM _migrations ORDER BY name");
    const appliedSet = new Set(applied.map((r) => r.name));

    const migrationsDir = path.resolve(__dirname, "../migrations");
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Migration applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
