import { Router } from "express";
import { nanoid } from "nanoid";
import { CreatePlanInput, PlanItemSchema } from "@gmd/shared";
import { addPlanItem, updatePlanItem, deletePlanItem, reorderPlanItems, movePlanItem } from "../storage.js";
import { pool } from "../db.js";

const router = Router();

router.post("/:date/plan", async (req, res) => {
  const input = CreatePlanInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });

  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
    [req.userId!, req.params.date]
  );
  const nextOrder = rows[0].next_order;

  const item = PlanItemSchema.parse({
    id: nanoid(8),
    description: input.data.description,
    category: input.data.category,
    duration: input.data.duration,
    scheduledTime: input.data.scheduledTime,
    completed: false,
    order: nextOrder,
  });

  await addPlanItem(req.userId!, req.params.date, item);
  res.status(201).json(item);
});

router.put("/:date/plan/:id", async (req, res) => {
  const updated = await updatePlanItem(req.userId!, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Plan item not found" });
  res.json(updated);
});

router.delete("/:date/plan/:id", async (req, res) => {
  await deletePlanItem(req.userId!, req.params.id);
  res.status(204).end();
});

router.put("/:date/plan/reorder", async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  const plan = await reorderPlanItems(req.userId!, req.params.date, ids);
  res.json(plan);
});

router.put("/:date/plan/:id/move", async (req, res) => {
  const { newDate } = req.body as { newDate: string };
  if (!newDate) return res.status(400).json({ error: "newDate required" });
  const moved = await movePlanItem(req.userId!, req.params.id, newDate);
  if (!moved) return res.status(404).json({ error: "Plan item not found" });
  res.json(moved);
});

export default router;
