import { Router } from "express";
import { nanoid } from "nanoid";
import { CreateTaskInput, TaskEntrySchema } from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { getDayLog, addTask, updateTask, deleteTask, moveTask, getIncompleteItems, carryOverItems } from "../storage.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getPreviousDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

const router = Router();

router.get("/:date", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) return res.status(400).json({ error: "Invalid date format" });
  const log = await getDayLog(req.userId!, req.params.date);
  res.json(log);
});

router.post("/:date/tasks", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) return res.status(400).json({ error: "Invalid date format" });
  const input = CreateTaskInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: zodMsg(input.error) });

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

// Carry-over: get incomplete items from previous day
router.get("/:date/carryover", async (req, res) => {
  const yesterday = getPreviousDate(req.params.date);
  const items = await getIncompleteItems(req.userId!, yesterday);
  res.json(items);
});

// Carry-over: move incomplete items from previous day to this day
router.post("/:date/carryover", async (req, res) => {
  const yesterday = getPreviousDate(req.params.date);
  const count = await carryOverItems(req.userId!, yesterday, req.params.date);
  res.json({ moved: count });
});

export default router;
