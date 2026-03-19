import { Router } from "express";
import { todayStr } from "@gmd/shared";
import { getStats, getCategoryCompletionRates, getEstimateAccuracy, getYearlyActivity } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const today = todayStr();
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = (req.query.to as string) || today;
  const [stats, categoryRates, estimateAccuracy] = await Promise.all([
    getStats(req.userId!, from, to),
    getCategoryCompletionRates(req.userId!, from, to),
    getEstimateAccuracy(req.userId!, from, to),
  ]);
  res.json({ ...stats, categoryRates, estimateAccuracy });
});

router.get("/yearly", async (req, res) => {
  const activity = await getYearlyActivity(req.userId!);
  res.json(activity);
});

export default router;
