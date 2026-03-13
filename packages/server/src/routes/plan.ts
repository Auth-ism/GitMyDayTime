import { Router } from "express";
import { nanoid } from "nanoid";
import { CreatePlanInput, PlanItemSchema } from "@gmd/shared";
import { getDayLog, saveDayLog } from "../storage.js";

const router = Router();

router.post("/:date/plan", async (req, res) => {
  const input = CreatePlanInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });

  const log = await getDayLog(req.params.date);
  const item = PlanItemSchema.parse({
    id: nanoid(8),
    description: input.data.description,
    category: input.data.category,
    estimatedDuration: input.data.estimatedDuration,
    completed: false,
    order: log.plan.length,
  });
  log.plan.push(item);
  await saveDayLog(log);
  res.status(201).json(item);
});

router.put("/:date/plan/:id", async (req, res) => {
  const log = await getDayLog(req.params.date);
  const idx = log.plan.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Plan item not found" });

  log.plan[idx] = { ...log.plan[idx], ...req.body, id: req.params.id };
  await saveDayLog(log);
  res.json(log.plan[idx]);
});

router.delete("/:date/plan/:id", async (req, res) => {
  const log = await getDayLog(req.params.date);
  log.plan = log.plan.filter((p) => p.id !== req.params.id);
  await saveDayLog(log);
  res.status(204).end();
});

router.put("/:date/plan/reorder", async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  const log = await getDayLog(req.params.date);
  const reordered = ids
    .map((id, i) => {
      const item = log.plan.find((p) => p.id === id);
      return item ? { ...item, order: i } : null;
    })
    .filter(Boolean);
  log.plan = reordered as typeof log.plan;
  await saveDayLog(log);
  res.json(log.plan);
});

export default router;
