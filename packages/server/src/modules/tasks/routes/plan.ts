import { Router, type Request, type Response, type NextFunction } from "express";
import { nanoid } from "nanoid";
import { CreatePlanInput, CreateChecklistInput, PlanItemSchema } from "@gmd/shared";
import { zodMsg } from "../../../validation.js";
import { addPlanItem, updatePlanItem, deletePlanItem, reorderPlanItems, movePlanItem, addChecklistItem, updateChecklistItem, deleteChecklistItem, copyDayPlans, invalidateDayLog, getOneYearAgoPlan, DuplicatePlanItemError } from "../storage.js";
import { pool } from "../../../db.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.post("/:date/plan", wrap(async (req, res) => {
  const date = req.params.date as string;
  if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const input = CreatePlanInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
    [req.userId!, date]
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

  try {
    await addPlanItem(req.userId!, date, item);
  } catch (err) {
    if (err instanceof DuplicatePlanItemError) {
      res.status(409).json({ error: err.message }); return;
    }
    throw err;
  }
  res.status(201).json(item);
}));

router.put("/:date/plan/reorder", wrap(async (req, res) => {
  const date = req.params.date as string;
  if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const { ids } = req.body as { ids: string[] };
  const plan = await reorderPlanItems(req.userId!, date, ids);
  res.json(plan);
}));

router.put("/:date/plan/:id", wrap(async (req, res) => {
  const updated = await updatePlanItem(req.userId!, req.params.id as string, req.body);
  if (!updated) { res.status(404).json({ error: "Plan item not found" }); return; }

  res.json(updated);
}));

router.delete("/:date/plan/:id", wrap(async (req, res) => {
  await deletePlanItem(req.userId!, req.params.id as string);
  res.status(204).end();
}));

router.put("/:date/plan/:id/move", wrap(async (req, res) => {
  const { newDate } = req.body as { newDate: string };
  if (!newDate) { res.status(400).json({ error: "newDate required" }); return; }
  const moved = await movePlanItem(req.userId!, req.params.id as string, newDate);
  if (!moved) { res.status(404).json({ error: "Plan item not found" }); return; }
  res.json(moved);
}));

router.get("/:date/one-year-ago", wrap(async (req, res) => {
  const date = req.params.date as string;
  if (!DATE_RE.test(date)) { res.status(400).json({ error: "Invalid date format" }); return; }
  const result = await getOneYearAgoPlan(req.userId!, date);
  res.json(result);
}));

router.post("/:date/copy-from/:fromDate", wrap(async (req, res) => {
  const date = req.params.date as string;
  const fromDate = req.params.fromDate as string;
  if (!DATE_RE.test(date) || !DATE_RE.test(fromDate)) {
    res.status(400).json({ error: "Invalid date" }); return;
  }
  const result = await copyDayPlans(req.userId!, fromDate, date);
  res.json(result);
}));

// ── Checklist ───────────────────────────────────────────────────

router.post("/:date/plan/:planId/checklist", wrap(async (req, res) => {
  const input = CreateChecklistInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const item = await addChecklistItem(req.userId!, req.params.planId as string, input.data.description);
  await invalidateDayLog(req.userId!, req.params.date as string);
  res.status(201).json(item);
}));

router.put("/:date/plan/:planId/checklist/:clId", wrap(async (req, res) => {
  const updated = await updateChecklistItem(req.userId!, req.params.clId as string, req.body);
  if (!updated) { res.status(404).json({ error: "Checklist item not found" }); return; }
  await invalidateDayLog(req.userId!, req.params.date as string);
  res.json(updated);
}));

router.delete("/:date/plan/:planId/checklist/:clId", wrap(async (req, res) => {
  await deleteChecklistItem(req.userId!, req.params.clId as string);
  await invalidateDayLog(req.userId!, req.params.date as string);
  res.status(204).end();
}));

export default router;
