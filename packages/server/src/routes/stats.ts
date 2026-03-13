import { Router } from "express";
import { Category } from "@gmd/shared";
import { listDays } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = (req.query.to as string) || new Date().toISOString().split("T")[0];
  const days = await listDays(from, to);

  const totalTasks = days.reduce((sum, d) => sum + d.tasks.length, 0);
  const totalMinutes = days.reduce(
    (sum, d) => sum + d.tasks.reduce((s, t) => s + (t.duration || 0), 0),
    0
  );

  const byCategory: Record<string, { count: number; minutes: number }> = {};
  for (const cat of Category.options) {
    byCategory[cat] = { count: 0, minutes: 0 };
  }
  for (const day of days) {
    for (const task of day.tasks) {
      byCategory[task.category].count++;
      byCategory[task.category].minutes += task.duration || 0;
    }
  }

  const dailyActivity = days.map((d) => ({
    date: d.date,
    tasks: d.tasks.length,
    planned: d.plan.length,
    completedPlan: d.plan.filter((p) => p.completed).length,
    minutes: d.tasks.reduce((s, t) => s + (t.duration || 0), 0),
  }));

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const day = days.find((dy) => dy.date === dateStr);
    if (day && day.tasks.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  res.json({ totalTasks, totalMinutes, byCategory, dailyActivity, streak, daysTracked: days.length });
});

export default router;
