import { Router, type Request, type Response, type NextFunction } from "express";
import { getJournal, upsertJournal } from "../storage.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const router = Router();

type DateReq = Request<{ date: string }>;

const wrap = (fn: (req: DateReq, res: Response, next: NextFunction) => Promise<void>) =>
  (req: DateReq, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/:date/journal", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date" }); return; }
  const content = await getJournal(req.userId!, req.params.date);
  res.json({ content });
}));

router.put("/:date/journal", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date" }); return; }
  const { content } = req.body as { content: string };
  if (typeof content !== "string") { res.status(400).json({ error: "content required" }); return; }
  await upsertJournal(req.userId!, req.params.date, content.slice(0, 10000));
  res.json({ ok: true });
}));

export default router;
