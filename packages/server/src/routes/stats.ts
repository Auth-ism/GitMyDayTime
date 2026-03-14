import { Router } from "express";
import { getStats } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = (req.query.to as string) || new Date().toISOString().split("T")[0];
  const stats = await getStats(req.userId!, from, to);
  res.json(stats);
});

export default router;
