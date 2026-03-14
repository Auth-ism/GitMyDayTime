import { Router } from "express";
import { nanoid } from "nanoid";
import { CreateTaskInput, TaskEntrySchema } from "@gmd/shared";
import { getDayLog, addTask, updateTask, deleteTask, moveTask } from "../storage.js";

const router = Router();

router.get("/:date", async (req, res) => {
  const log = await getDayLog(req.userId!, req.params.date);
  res.json(log);
});

router.post("/:date/tasks", async (req, res) => {
  const input = CreateTaskInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });

  const task = TaskEntrySchema.parse({
    id: nanoid(8),
    timestamp: new Date().toISOString(),
    description: input.data.description,
    category: input.data.category,
    duration: input.data.duration,
    tags: input.data.tags,
    completed: false,
  });

  await addTask(req.userId!, req.params.date, task);
  res.status(201).json(task);
});

router.put("/:date/tasks/:id", async (req, res) => {
  const updated = await updateTask(req.userId!, req.params.date, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Task not found" });
  res.json(updated);
});

router.delete("/:date/tasks/:id", async (req, res) => {
  await deleteTask(req.userId!, req.params.id);
  res.status(204).end();
});

router.put("/:date/tasks/:id/move", async (req, res) => {
  const { newDate } = req.body as { newDate: string };
  if (!newDate) return res.status(400).json({ error: "newDate required" });
  const moved = await moveTask(req.userId!, req.params.id, newDate);
  if (!moved) return res.status(404).json({ error: "Task not found" });
  res.json(moved);
});

export default router;
