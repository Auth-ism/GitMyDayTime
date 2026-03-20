import { Router, type Request, type Response, type NextFunction } from "express";
import { nanoid } from "nanoid";
import { CreateTaskInput, TaskEntrySchema } from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { getDayLog, addTask, updateTask, deleteTask, moveTask, getIncompleteItems, carryOverItems } from "../storage.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/:date", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const log = await getDayLog(req.userId!, req.params.date);
  res.json(log);
}));

router.post("/:date/tasks", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const input = CreateTaskInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

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
}));

router.put("/:date/tasks/:id", wrap(async (req, res) => {
  const updated = await updateTask(req.userId!, req.params.date as string, req.params.id as string, req.body);
  if (!updated) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(updated);
}));

router.delete("/:date/tasks/:id", wrap(async (req, res) => {
  await deleteTask(req.userId!, req.params.id as string);
  res.status(204).end();
}));

router.put("/:date/tasks/:id/move", wrap(async (req, res) => {
  const { newDate } = req.body as { newDate: string };
  if (!newDate) { res.status(400).json({ error: "newDate required" }); return; }
  const moved = await moveTask(req.userId!, req.params.id as string, newDate);
  if (!moved) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(moved);
}));

// Carry-over: get incomplete items from previous day
router.get("/:date/carryover", wrap(async (req, res) => {
  const yesterday = getPreviousDate(req.params.date as string);
  const items = await getIncompleteItems(req.userId!, yesterday);
  res.json(items);
}));

// Carry-over: move incomplete items from previous day to this day
router.post("/:date/carryover", wrap(async (req, res) => {
  const yesterday = getPreviousDate(req.params.date as string);
  const count = await carryOverItems(req.userId!, yesterday, req.params.date as string);
  res.json({ moved: count });
}));

function getPreviousDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export default router;
