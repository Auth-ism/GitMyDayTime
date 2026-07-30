import type {
  Insight,
  TemporalPatterns,
  CategoryWeekPoint,
  BehavioralMetrics,
} from "@gmd/shared";
import type { AggregateBundle } from "./storage.js";

/**
 * Minimum evidence each rule needs before it is allowed to say anything.
 *
 * These exist because a rule with two data points will happily produce a
 * confident-sounding lie. If a threshold isn't met the insight is simply not
 * emitted — the UI shows "not enough data yet" instead of filler.
 */
const MIN = {
  PEAK_HOUR_COMPLETIONS: 20,
  DRIFT_WEEKS_PER_SIDE: 3,
  DRIFT_ITEMS: 10,
  DRIFT_PCT: 25,
  BIAS_ITEMS_PER_BUCKET: 8,
  BIAS_DEVIATION_PCT: 20,
  POSTPONE_ITEMS: 10,
  POSTPONE_MULTIPLIER: 2,
  /** Below this, other buckets are effectively never postponed — no ratio claim. */
  POSTPONE_BASELINE: 0.2,
  /** Postpones per item needed to be worth mentioning on its own. */
  POSTPONE_ABSOLUTE: 1,
  BEST_DOW_DAYS_COVERED: 28,
  BEST_DOW_COMPLETIONS: 20,
} as const;

/** Widest window of consecutive hours holding the largest share of completions. */
const PEAK_WINDOW_HOURS = 3;

function peakHours(temporal: TemporalPatterns): Insight | null {
  if (temporal.liveCompletions < MIN.PEAK_HOUR_COMPLETIONS) return null;

  let bestStart = 0;
  let bestSum = -1;
  for (let start = 0; start <= 24 - PEAK_WINDOW_HOURS; start++) {
    let sum = 0;
    for (let i = 0; i < PEAK_WINDOW_HOURS; i++) sum += temporal.byHour[start + i].completed;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }
  if (bestSum <= 0) return null;

  const pct = Math.round((bestSum / temporal.liveCompletions) * 100);
  // A flat distribution would put ~12.5% in any 3-hour window; below that it's noise.
  if (pct < 25) return null;

  return {
    id: "peak_hours",
    kind: "peak_hours",
    confidence: temporal.liveCompletions >= MIN.PEAK_HOUR_COMPLETIONS * 2 ? "high" : "low",
    params: {
      from: `${String(bestStart).padStart(2, "0")}:00`,
      to: `${String(bestStart + PEAK_WINDOW_HOURS).padStart(2, "0")}:00`,
      pct,
    },
  };
}

function categoryDrift(points: CategoryWeekPoint[]): Insight | null {
  const weeks = [...new Set(points.map((p) => p.week))].sort();
  if (weeks.length < MIN.DRIFT_WEEKS_PER_SIDE * 2) return null;

  const recentWeeks = new Set(weeks.slice(-MIN.DRIFT_WEEKS_PER_SIDE));
  const priorWeeks = new Set(weeks.slice(-MIN.DRIFT_WEEKS_PER_SIDE * 2, -MIN.DRIFT_WEEKS_PER_SIDE));

  const recent = new Map<string, number>();
  const prior = new Map<string, number>();
  let items = 0;

  for (const p of points) {
    items += p.count;
    const target = recentWeeks.has(p.week) ? recent : priorWeeks.has(p.week) ? prior : null;
    if (target) target.set(p.category, (target.get(p.category) ?? 0) + p.minutes);
  }
  if (items < MIN.DRIFT_ITEMS) return null;

  let best: { category: string; pct: number } | null = null;
  for (const [category, priorMinutes] of prior) {
    if (priorMinutes <= 0) continue;
    const recentMinutes = recent.get(category) ?? 0;
    const pct = Math.round(((recentMinutes - priorMinutes) / priorMinutes) * 100);
    if (Math.abs(pct) < MIN.DRIFT_PCT) continue;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { category, pct };
  }
  if (!best) return null;

  return {
    id: `category_drift:${best.category}`,
    kind: "category_drift",
    confidence: items >= MIN.DRIFT_ITEMS * 2 ? "high" : "low",
    params: {
      category: best.category,
      direction: best.pct > 0 ? "up" : "down",
      pct: Math.abs(best.pct),
      weeks: MIN.DRIFT_WEEKS_PER_SIDE,
    },
  };
}

function estimateBias(behavioral: BehavioralMetrics): Insight | null {
  const eligible = behavioral.estimateBias.filter((b) => b.items >= MIN.BIAS_ITEMS_PER_BUCKET);
  if (eligible.length === 0) return null;

  // Surface the bucket where estimates are furthest from reality.
  const worst = eligible.reduce((a, b) =>
    Math.abs(b.ratio - 1) > Math.abs(a.ratio - 1) ? b : a
  );
  const deviationPct = Math.round(Math.abs(worst.ratio - 1) * 100);
  if (deviationPct < MIN.BIAS_DEVIATION_PCT) return null;

  return {
    id: `estimate_bias:${worst.bucket}`,
    kind: "estimate_bias",
    confidence: worst.items >= MIN.BIAS_ITEMS_PER_BUCKET * 2 ? "high" : "low",
    params: {
      bucket: worst.bucket,
      direction: worst.ratio > 1 ? "over" : "under",
      pct: deviationPct,
      items: worst.items,
    },
  };
}

function postponeRisk(behavioral: BehavioralMetrics): Insight | null {
  const eligible = behavioral.postpones.filter((p) => p.items >= 3);
  const totalItems = behavioral.postpones.reduce((sum, p) => sum + p.items, 0);
  if (totalItems < MIN.POSTPONE_ITEMS || behavioral.totalPostponed === 0) return null;
  if (eligible.length < 2) return null;

  const worst = eligible.reduce((a, b) => (b.avgPostpones > a.avgPostpones ? b : a));
  if (worst.avgPostpones <= 0) return null;

  const others = eligible.filter((p) => p.bucket !== worst.bucket);
  if (others.length === 0) return null;
  const baseline = others.reduce((sum, p) => sum + p.avgPostpones, 0) / others.length;

  const confidence = totalItems >= MIN.POSTPONE_ITEMS * 2 ? "high" : "low";

  // A ratio against a near-zero baseline explodes into a meaningless number
  // ("30x more often" when the others were never postponed at all), so only
  // claim a multiplier when there is a real baseline to divide by.
  if (baseline < MIN.POSTPONE_BASELINE) {
    if (worst.avgPostpones < MIN.POSTPONE_ABSOLUTE) return null;
    return {
      id: `postpone_risk:${worst.bucket}`,
      kind: "postpone_risk",
      confidence,
      params: {
        bucket: worst.bucket,
        variant: "absolute",
        avgPostpones: Math.round(worst.avgPostpones * 10) / 10,
      },
    };
  }

  const multiplier = worst.avgPostpones / baseline;
  if (multiplier < MIN.POSTPONE_MULTIPLIER) return null;

  return {
    id: `postpone_risk:${worst.bucket}`,
    kind: "postpone_risk",
    confidence,
    params: {
      bucket: worst.bucket,
      variant: "relative",
      multiplier: Math.round(multiplier * 10) / 10,
    },
  };
}

function bestDow(temporal: TemporalPatterns, daysCovered: number): Insight | null {
  if (daysCovered < MIN.BEST_DOW_DAYS_COVERED) return null;
  if (temporal.liveCompletions < MIN.BEST_DOW_COMPLETIONS) return null;

  const best = temporal.byDow.reduce((a, b) => (b.completed > a.completed ? b : a));
  if (best.completed <= 0) return null;

  const pct = Math.round((best.completed / temporal.liveCompletions) * 100);
  // Evenly spread days would sit near 14%; require a real lead.
  if (pct < 20) return null;

  return {
    id: `best_dow:${best.dow}`,
    kind: "best_dow",
    confidence: temporal.liveCompletions >= MIN.BEST_DOW_COMPLETIONS * 2 ? "high" : "low",
    params: { dow: best.dow, pct, completed: best.completed },
  };
}

/** Runs every rule and drops the ones that lack evidence. */
export function buildInsights(bundle: AggregateBundle): Insight[] {
  const candidates = [
    peakHours(bundle.temporal),
    categoryDrift(bundle.categoryDrift),
    estimateBias(bundle.behavioral),
    postponeRisk(bundle.behavioral),
    bestDow(bundle.temporal, bundle.coverage.daysCovered),
  ];
  return candidates.filter((i): i is Insight => i !== null);
}
