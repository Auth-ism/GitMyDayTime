import { Router } from "express";
import { nanoid } from "nanoid";
import { CreateTaskInput, TaskEntrySchema } from "@gmd/shared";
import { getDayLog, saveDayLog } from "../storage.js";

const router = Router();

router.get("/:date", async (req, res) => {
  const log = await getDayLog(req.params.date);
  res.json(log);
});

router.post("/:date/tasks", async (req, res) => {
  const input = CreateTaskInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });

  const log = await getDayLog(req.params.date);
  const task = TaskEntrySchema.parse({
    id: nanoid(8),
    timestamp: new Date().toISOString(),
    description: input.data.description,
    category: input.data.category,
    duration: input.data.duration,
    tags: input.data.tags,
    completed: false,
  });
  log.tasks.push(task);
  await saveDayLog(log);
  res.status(201).json(task);
});

router.put("/:date/tasks/:id", async (req, res) => {
  const log = await getDayLog(req.params.date);
  const idx = log.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Task not found" });

  log.tasks[idx] = { ...log.tasks[idx], ...req.body, id: req.params.id };
  await saveDayLog(log);
  res.json(log.tasks[idx]);
});

router.delete("/:date/tasks/:id", async (req, res) => {
  const log = await getDayLog(req.params.date);
  log.tasks = log.tasks.filter((t) => t.id !== req.params.id);
  await saveDayLog(log);
  res.status(204).end();
});

export default router;
