import { Router, type Request, type Response, type NextFunction } from "express";
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

function validateImportItems(items: any[], requiredFields: string[]): boolean {
  return items.every((item) =>
    requiredFields.every((f) => item[f] != null) &&
    (item.date ? DATE_RE.test(item.date) : true) &&
    (item.description ? typeof item.description === "string" : true)
  );
}

router.post("/import", wrap(async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.plans) || !Array.isArray(data.tasks)) {
    res.status(400).json({ error: "Invalid import data" });
    return;
  }
  if (!validateImportItems(data.plans, ["date", "description"]) ||
      !validateImportItems(data.tasks, ["date", "description"])) {
    res.status(400).json({ error: "Invalid items: each must have date (YYYY-MM-DD) and description" });
    return;
  }
  const result = await importUserData(req.userId!, data);
  res.json(result);
}));

export default router;
