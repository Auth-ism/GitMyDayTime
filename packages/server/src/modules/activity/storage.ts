import { pool } from "../../db.js";
import { cacheGet, cacheSet } from "../../redis.js";
import type {
  TemporalPatterns,
  CategoryWeekPoint,
  BehavioralMetrics,
  PostponeStat,
  EstimateBiasStat,
  DurationBucket,
} from "@gmd/shared";

const TTL_INSIGHTS = 300; // 5 min, same as stats

/** Shared bucket expression so every behavioral query slices durations identically. */
const BUCKET_SQL = `
  CASE
    WHEN estimated_duration < 30  THEN 'lt30'
    WHEN estimated_duration < 60  THEN '30to60'
    WHEN estimated_duration < 120 THEN '60to120'
    ELSE 'gt120'
  END`;

export async function invalidateInsights(userId: string): Promise<void> {
  const { cacheDelPattern } = await import("../../redis.js");
  await cacheDelPattern(`insights:${userId}:*`);
}

/**
 * Completion/creation counts by hour of day and day of week, in the user's
 * local timezone (already denormalized at write time).
 *
 * liveCompletions is reported separately because the 034 backfill only seeded
 * plan_created rows — time-of-day completion rules must not claim more evidence
 * than actually exists.
 */
export async function getTemporalPatterns(
  userId: string,
  from: string,
  to: string
): Promise<TemporalPatterns> {
  const { rows } = await pool.query(
    `SELECT local_hour, local_dow,
            COUNT(*) FILTER (WHERE event_type = 'plan_completed')::int AS completed,
            COUNT(*) FILTER (WHERE event_type = 'plan_created')::int   AS created
     FROM activity_events
     WHERE user_id = $1
       AND local_date BETWEEN $2 AND $3
       AND event_type IN ('plan_completed', 'plan_created')
     GROUP BY local_hour, local_dow`,
    [userId, from, to]
  );

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, completed: 0, created: 0 }));
  const byDow = Array.from({ length: 7 }, (_, dow) => ({ dow, completed: 0, created: 0 }));

  for (const r of rows) {
    byHour[r.local_hour].completed += r.completed;
    byHour[r.local_hour].created += r.created;
    byDow[r.local_dow].completed += r.completed;
    byDow[r.local_dow].created += r.created;
  }

  const liveCompletions = byHour.reduce((sum, h) => sum + h.completed, 0);
  return { byHour, byDow, liveCompletions };
}

/**
 * Per-category minutes per ISO week.
 *
 * Reads plan_items rather than the event log: minutes live on the item and the
 * full history is already there, so category drift has no backfill gap.
 */
export async function getCategoryDrift(
  userId: string,
  weeks: number
): Promise<CategoryWeekPoint[]> {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('week', date), 'IYYY-"W"IW') AS week,
            category,
            COALESCE(SUM(actual_duration), 0)::int AS minutes,
            COUNT(*)::int AS count
     FROM plan_items
     WHERE user_id = $1
       AND item_type = 'plan'
       AND completed = TRUE
       AND date >= CURRENT_DATE - ($2::int * 7)
     GROUP BY 1, 2
     ORDER BY 1, 2`,
    [userId, weeks]
  );
  return rows as CategoryWeekPoint[];
}

/**
 * How often items get pushed before they're done, and how far estimates drift
 * from reality — both sliced by estimated-duration bucket.
 */
export async function getBehavioralMetrics(
  userId: string,
  from: string,
  to: string
): Promise<BehavioralMetrics> {
  const [postponeRes, biasRes] = await Promise.all([
    pool.query(
      `WITH moves AS (
         SELECT e.entity_id, COUNT(*)::int AS postpones
         FROM activity_events e
         WHERE e.user_id = $1
           AND e.event_type IN ('plan_moved', 'plan_carried_over')
         GROUP BY e.entity_id
       )
       SELECT ${BUCKET_SQL} AS bucket,
              COUNT(*)::int AS items,
              AVG(COALESCE(m.postpones, 0))::numeric(10,2) AS "avgPostpones",
              COUNT(*) FILTER (WHERE COALESCE(m.postpones, 0) > 0)::int AS postponed
       FROM plan_items p
       LEFT JOIN moves m ON m.entity_id = p.id
       WHERE p.user_id = $1
         AND p.item_type = 'plan'
         AND p.date BETWEEN $2 AND $3
         AND p.estimated_duration IS NOT NULL
       GROUP BY 1`,
      [userId, from, to]
    ),
    pool.query(
      `SELECT ${BUCKET_SQL} AS bucket,
              COUNT(*)::int AS items,
              AVG(estimated_duration)::int AS "avgEstimate",
              AVG(actual_duration)::int AS "avgActual"
       FROM plan_items
       WHERE user_id = $1
         AND item_type = 'plan'
         AND date BETWEEN $2 AND $3
         AND completed = TRUE
         AND estimated_duration IS NOT NULL
         AND actual_duration IS NOT NULL
       GROUP BY 1`,
      [userId, from, to]
    ),
  ]);

  const postpones: PostponeStat[] = postponeRes.rows.map((r) => ({
    bucket: r.bucket as DurationBucket,
    items: r.items,
    avgPostpones: Number(r.avgPostpones),
  }));

  const estimateBias: EstimateBiasStat[] = biasRes.rows.map((r) => ({
    bucket: r.bucket as DurationBucket,
    items: r.items,
    avgEstimate: r.avgEstimate,
    avgActual: r.avgActual,
    ratio: r.avgEstimate > 0 ? r.avgActual / r.avgEstimate : 0,
  }));

  const totalPostponed = postponeRes.rows.reduce((sum, r) => sum + r.postponed, 0);
  return { postpones, estimateBias, totalPostponed };
}

export async function getEventCoverage(
  userId: string
): Promise<{ eventCount: number; liveEventCount: number; daysCovered: number }> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS "eventCount",
            COUNT(*) FILTER (WHERE source <> 'backfill')::int AS "liveEventCount",
            COUNT(DISTINCT local_date)::int AS "daysCovered"
     FROM activity_events WHERE user_id = $1`,
    [userId]
  );
  return rows[0] as { eventCount: number; liveEventCount: number; daysCovered: number };
}

export interface AggregateBundle {
  temporal: TemporalPatterns;
  categoryDrift: CategoryWeekPoint[];
  behavioral: BehavioralMetrics;
  coverage: { eventCount: number; liveEventCount: number; daysCovered: number };
}

/**
 * Computed on read and cached in Redis, mirroring getStats. At this data volume
 * a scheduled rollup would be complexity with no payoff.
 */
export async function getAggregates(
  userId: string,
  from: string,
  to: string,
  driftWeeks: number
): Promise<AggregateBundle> {
  const cacheKey = `insights:${userId}:${from}:${to}`;
  const cached = await cacheGet<AggregateBundle>(cacheKey);
  if (cached) return cached;

  const [temporal, categoryDrift, behavioral, coverage] = await Promise.all([
    getTemporalPatterns(userId, from, to),
    getCategoryDrift(userId, driftWeeks),
    getBehavioralMetrics(userId, from, to),
    getEventCoverage(userId),
  ]);

  const result = { temporal, categoryDrift, behavioral, coverage };
  await cacheSet(cacheKey, result, TTL_INSIGHTS);
  return result;
}
