import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getJournal, upsertJournal } from "../storage.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const router = Router();

type DateReq = Request<{ date: string }>;

const wrap = (fn: (req: DateReq, res: Response, next: NextFunction) => Promise<void>) =>
  (req: DateReq, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

const JournalInput = z.object({
  content: z.string().max(10000),
});

router.get("/:date/journal", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date" }); return; }
  const content = await getJournal(req.userId!, req.params.date);
  res.json({ content });
}));

router.put("/:date/journal", wrap(async (req, res) => {
  if (!DATE_RE.test(req.params.date)) { res.status(400).json({ error: "Invalid date" }); return; }
  const parsed = JournalInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid content" });
    return;
  }
  await upsertJournal(req.userId!, req.params.date, parsed.data.content);
  res.json({ ok: true });
}));

export default router;
