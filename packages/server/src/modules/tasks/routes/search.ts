import { Router, type Request, type Response, type NextFunction } from "express";
import { searchItems } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const q = (req.query.q as string || "").trim().toLowerCase();
  if (!q) { res.json({ plans: [], tasks: [] }); return; }
  const results = await searchItems(req.userId!, q);
  res.json(results);
}));

export default router;
