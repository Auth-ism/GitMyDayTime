import { Router, type Request, type Response, type NextFunction } from "express";
import { searchItems } from "../storage.js";
import { searchIssues } from "../storage/projects.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const q = (req.query.q as string || "").trim().toLowerCase();
  if (!q) { res.json({ plans: [], tasks: [], issues: [] }); return; }
  const [results, issues] = await Promise.all([
    searchItems(req.userId!, q),
    searchIssues(req.userId!, q),
  ]);
  res.json({ ...results, issues });
}));

export default router;
