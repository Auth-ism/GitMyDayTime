import { Router } from "express";
import { nanoid } from "nanoid";
import { CreateRecurringTaskInput } from "@gmd/shared";
import { getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask, injectRecurringTasks } from "../storage.js";

const router = Router();

// List all recurring tasks
router.get("/", async (req, res) => {
  const tasks = await getRecurringTasks(req.userId!);
  res.json(tasks);
});

// Create a recurring task
router.post("/", async (req, res) => {
  const input = CreateRecurringTaskInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });

  const task = await createRecurringTask(req.userId!, nanoid(8), input.data);
  res.status(201).json(task);
});

// Update a recurring task
router.put("/:id", async (req, res) => {
  const updated = await updateRecurringTask(req.userId!, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Recurring task not found" });
  res.json(updated);
});

// Delete a recurring task
router.delete("/:id", async (req, res) => {
  await deleteRecurringTask(req.userId!, req.params.id);
  res.status(204).end();
});

// Inject recurring tasks for a specific date
router.post("/inject/:date", async (req, res) => {
  const created = await injectRecurringTasks(req.userId!, req.params.date);
  res.json({ injected: created.length, items: created });
});

export default router;
