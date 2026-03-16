import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DayLogSchema } from "@gmd/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const userId = process.argv.find((a) => a.startsWith("--user-id="))?.split("=")[1];
if (!userId) {
  console.error("Usage: npx tsx packages/server/src/migrate-data.ts --user-id=<uuid>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const storageDir = path.resolve(process.cwd(), "storage");

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(fullPath)));
      } else if (entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

async function main() {
  const files = await walk(storageDir);
  console.log(`Found ${files.length} day files to migrate`);

  let taskCount = 0;
  let planCount = 0;

  for (const file of files) {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = DayLogSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn(`Skipping invalid file: ${file}`);
      continue;
    }

    const dayLog = parsed.data;

    for (const task of dayLog.tasks) {
      await pool.query(
        `INSERT INTO tasks (id, user_id, date, timestamp, description, category, duration, tags, completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [task.id, userId, dayLog.date, task.timestamp, task.description, task.category, task.duration ?? null, task.tags, task.completed]
      );
      taskCount++;
    }

    for (const item of dayLog.plan) {
      await pool.query(
        `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, userId, dayLog.date, item.description, item.category, item.duration ?? null, item.completed, item.order]
      );
      planCount++;
    }
  }

  console.log(`Migrated ${taskCount} tasks and ${planCount} plan items for user ${userId}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
