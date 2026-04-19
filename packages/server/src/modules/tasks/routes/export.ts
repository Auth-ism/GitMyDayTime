import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { Category, PriorityType } from "@gmd/shared";
import { exportUserData, importUserData } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const data = await exportUserData(req.userId!);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="gmd-export-${new Date().toISOString().split("T")[0]}.json"`);
  res.json(data);
}));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ImportPlanSchema = z.object({
  date: z.string().regex(DATE_RE),
  description: z.string().min(1).max(500),
  category: Category.default("other"),
  duration: z.number().min(0).max(1440).optional(),
  completed: z.boolean().default(false),
  scheduledTime: z.string().optional(),
  itemType: z.enum(["plan", "reminder"]).default("plan"),
  priority: PriorityType.default("normal"),
  actualDuration: z.number().min(0).max(1440).optional(),
}).passthrough();

const ImportTaskSchema = z.object({
  date: z.string().regex(DATE_RE),
  description: z.string().min(1).max(500),
  category: Category.default("other"),
  duration: z.number().min(0).max(1440).optional(),
  tags: z.array(z.string().max(50)).default([]),
}).passthrough();

const ImportRecurringSchema = z.object({
  description: z.string().min(1).max(500),
  category: Category.default("other"),
  recurrence: z.enum(["daily", "weekdays", "weekly", "custom"]),
  duration: z.number().min(0).max(1440).optional(),
  scheduledTime: z.string().optional(),
  weekDay: z.number().min(0).max(6).optional(),
  customDays: z.array(z.number().min(0).max(6)).optional(),
}).passthrough();

const ImportJournalSchema = z.object({
  date: z.string().regex(DATE_RE),
  content: z.string().max(10000),
}).passthrough();

const MAX_IMPORT_ITEMS = 5000;

router.post("/import", wrap(async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.plans) || !Array.isArray(data.tasks)) {
    res.status(400).json({ error: "Invalid import data" });
    return;
  }

  if (data.plans.length > MAX_IMPORT_ITEMS || data.tasks.length > MAX_IMPORT_ITEMS) {
    res.status(400).json({ error: `Too many items (max ${MAX_IMPORT_ITEMS} per type)` });
    return;
  }

  // Validate plans
  const validPlans: any[] = [];
  for (const item of data.plans) {
    const parsed = ImportPlanSchema.safeParse(item);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid plan item: ${parsed.error.issues[0]?.message}` });
      return;
    }
    validPlans.push(parsed.data);
  }

  // Validate tasks
  const validTasks: any[] = [];
  for (const item of data.tasks) {
    const parsed = ImportTaskSchema.safeParse(item);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid task item: ${parsed.error.issues[0]?.message}` });
      return;
    }
    validTasks.push(parsed.data);
  }

  // Validate optional recurring tasks
  const validRecurring: any[] = [];
  if (Array.isArray(data.recurringTasks)) {
    if (data.recurringTasks.length > MAX_IMPORT_ITEMS) {
      res.status(400).json({ error: `Too many recurring items (max ${MAX_IMPORT_ITEMS})` });
      return;
    }
    for (const item of data.recurringTasks) {
      const parsed = ImportRecurringSchema.safeParse(item);
      if (!parsed.success) {
        res.status(400).json({ error: `Invalid recurring item: ${parsed.error.issues[0]?.message}` });
        return;
      }
      validRecurring.push(parsed.data);
    }
  }

  // Validate optional journals
  const validJournals: any[] = [];
  if (Array.isArray(data.journals)) {
    if (data.journals.length > MAX_IMPORT_ITEMS) {
      res.status(400).json({ error: `Too many journal items (max ${MAX_IMPORT_ITEMS})` });
      return;
    }
    for (const item of data.journals) {
      const parsed = ImportJournalSchema.safeParse(item);
      if (!parsed.success) {
        res.status(400).json({ error: `Invalid journal item: ${parsed.error.issues[0]?.message}` });
        return;
      }
      validJournals.push(parsed.data);
    }
  }

  const result = await importUserData(req.userId!, {
    plans: validPlans,
    tasks: validTasks,
    recurringTasks: validRecurring,
    journals: validJournals,
  });
  res.json(result);
}));

export default router;
