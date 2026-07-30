import { Router, type Request, type Response, type NextFunction } from "express";
import { todayStr } from "@gmd/shared";
import { getStats, getCategoryCompletionRates, getEstimateAccuracy, getYearlyActivity } from "../storage.js";
import { getAggregates, buildInsights } from "../../activity/index.js";

const router = Router();

/** Weeks of history the category-drift rule compares (2 windows of 3 weeks). */
const DRIFT_WEEKS = 6;
/** Insights need a longer window than the 30-day stats view to spot drift. */
const INSIGHTS_DAYS = 90;

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const today = todayStr();
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = (req.query.to as string) || today;
  const [stats, categoryRates, estimateAccuracy] = await Promise.all([
    getStats(req.userId!, from, to),
    getCategoryCompletionRates(req.userId!, from, to),
    getEstimateAccuracy(req.userId!, from, to),
  ]);
  res.json({ ...stats, categoryRates, estimateAccuracy });
}));

router.get("/yearly", wrap(async (req, res) => {
  const activity = await getYearlyActivity(req.userId!);
  res.json(activity);
}));

router.get("/insights", wrap(async (req, res) => {
  const to = todayStr();
  const from = new Date(Date.now() - INSIGHTS_DAYS * 86400000).toISOString().split("T")[0];

  const bundle = await getAggregates(req.userId!, from, to, DRIFT_WEEKS);
  const insights = buildInsights(bundle);

  res.json({
    insights,
    temporal: bundle.temporal,
    categoryDrift: bundle.categoryDrift,
    behavioral: bundle.behavioral,
    dataQuality: {
      eventCount: bundle.coverage.eventCount,
      liveEventCount: bundle.coverage.liveEventCount,
      daysCovered: bundle.coverage.daysCovered,
      ready: insights.length > 0,
    },
  });
}));

export default router;
