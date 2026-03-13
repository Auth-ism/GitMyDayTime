import fs from "node:fs/promises";
import path from "node:path";
import { DayLog, DayLogSchema, dateToPath } from "@gmd/shared";

const STORAGE_DIR = path.resolve(process.cwd(), "storage");

function dayFilePath(date: string): string {
  return path.join(STORAGE_DIR, dateToPath(date));
}

export async function getDayLog(date: string): Promise<DayLog> {
  const filePath = dayFilePath(date);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return DayLogSchema.parse(JSON.parse(raw));
  } catch {
    return { date, plan: [], tasks: [] };
  }
}

export async function saveDayLog(dayLog: DayLog): Promise<void> {
  const filePath = dayFilePath(dayLog.date);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(dayLog, null, 2), "utf-8");
}

export async function listDays(from: string, to: string): Promise<DayLog[]> {
  const days: DayLog[] = [];
  const start = new Date(from);
  const end = new Date(to);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const log = await getDayLog(dateStr);
    if (log.tasks.length > 0 || log.plan.length > 0) {
      days.push(log);
    }
  }
  return days;
}
