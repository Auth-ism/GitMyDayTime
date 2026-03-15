import { Router } from "express";
import { searchItems } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) return res.json({ plans: [], tasks: [] });
  const results = await searchItems(req.userId!, q);
  res.json(results);
});

export default router;
