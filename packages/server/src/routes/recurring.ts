import { Router, type Request, type Response, type NextFunction } from "express";
import { nanoid } from "nanoid";
import { CreateRecurringTaskInput } from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask, injectRecurringTasks } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// List all recurring tasks
router.get("/", wrap(async (req, res) => {
  const tasks = await getRecurringTasks(req.userId!);
  res.json(tasks);
}));

// Create a recurring task
router.post("/", wrap(async (req, res) => {
  const input = CreateRecurringTaskInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const task = await createRecurringTask(req.userId!, nanoid(8), input.data);
  res.status(201).json(task);
}));

// Update a recurring task
router.put("/:id", wrap(async (req, res) => {
  const updated = await updateRecurringTask(req.userId!, req.params.id, req.body);
  if (!updated) { res.status(404).json({ error: "Recurring task not found" }); return; }
  res.json(updated);
}));

// Delete a recurring task
router.delete("/:id", wrap(async (req, res) => {
  await deleteRecurringTask(req.userId!, req.params.id);
  res.status(204).end();
}));

// Inject recurring tasks for a specific date
router.post("/inject/:date", wrap(async (req, res) => {
  const created = await injectRecurringTasks(req.userId!, req.params.date);
  res.json({ injected: created.length, items: created });
}));

export default router;
