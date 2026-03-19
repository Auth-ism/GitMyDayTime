import { Router } from "express";
import { getJournal, upsertJournal } from "../storage.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const router = Router();

router.get("/:date/journal", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) return res.status(400).json({ error: "Invalid date" });
  const content = await getJournal(req.userId!, req.params.date);
  res.json({ content });
});

router.put("/:date/journal", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) return res.status(400).json({ error: "Invalid date" });
  const { content } = req.body as { content: string };
  if (typeof content !== "string") return res.status(400).json({ error: "content required" });
  await upsertJournal(req.userId!, req.params.date, content.slice(0, 10000));
  res.json({ ok: true });
});

export default router;
