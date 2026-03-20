import { Router, type Request, type Response, type NextFunction } from "express";
import { nanoid } from "nanoid";
import { CreatePlanInput, CreateChecklistInput, PlanItemSchema } from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { addPlanItem, updatePlanItem, deletePlanItem, reorderPlanItems, movePlanItem, addChecklistItem, updateChecklistItem, deleteChecklistItem, copyDayPlans } from "../storage.js";
import { pool } from "../db.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.post("/:date/plan", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const input = CreatePlanInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

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
    itemType: input.data.itemType ?? "plan",
    priority: input.data.priority ?? "normal",
  });

  await addPlanItem(req.userId!, req.params.date, item);
  res.status(201).json(item);
}));

router.put("/:date/plan/reorder", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const { ids } = req.body as { ids: string[] };
  const plan = await reorderPlanItems(req.userId!, req.params.date, ids);
  res.json(plan);
}));

router.put("/:date/plan/:id", wrap(async (req, res) => {
  const updated = await updatePlanItem(req.userId!, req.params.id, req.body);
  if (!updated) { res.status(404).json({ error: "Plan item not found" }); return; }
  res.json(updated);
}));

router.delete("/:date/plan/:id", wrap(async (req, res) => {
  await deletePlanItem(req.userId!, req.params.id);
  res.status(204).end();
}));

router.put("/:date/plan/:id/move", wrap(async (req, res) => {
  const { newDate } = req.body as { newDate: string };
  if (!newDate) { res.status(400).json({ error: "newDate required" }); return; }
  const moved = await movePlanItem(req.userId!, req.params.id, newDate);
  if (!moved) { res.status(404).json({ error: "Plan item not found" }); return; }
  res.json(moved);
}));

router.post("/:date/copy-from/:fromDate", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date) || !DATE_RE.test(req.params.fromDate)) {
    res.status(400).json({ error: "Invalid date" }); return;
  }
  const count = await copyDayPlans(req.userId!, req.params.fromDate, req.params.date);
  res.json({ copied: count });
}));

// ── Checklist ───────────────────────────────────────────────────

router.post("/:date/plan/:planId/checklist", wrap(async (req, res) => {
  const input = CreateChecklistInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const item = await addChecklistItem(req.userId!, req.params.planId, input.data.description);
  res.status(201).json(item);
}));

router.put("/:date/plan/:planId/checklist/:clId", wrap(async (req, res) => {
  const updated = await updateChecklistItem(req.userId!, req.params.clId, req.body);
  if (!updated) { res.status(404).json({ error: "Checklist item not found" }); return; }
  res.json(updated);
}));

router.delete("/:date/plan/:planId/checklist/:clId", wrap(async (req, res) => {
  await deleteChecklistItem(req.userId!, req.params.clId);
  res.status(204).end();
}));

export default router;
