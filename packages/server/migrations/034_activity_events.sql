-- Activity event log (GMD-4)
--
-- Append-only log of meaningful user activity. Separate from plan_items so every
-- existing "WHERE user_id = $1" query stays untouched.
--
-- local_date / local_hour / local_dow are denormalized at write time using the
-- user's own timezone (users.timezone). Storing them avoids repeated timezone
-- conversion in aggregation queries and sidesteps the UTC off-by-one-day bug
-- that ISO-string date handling causes for Istanbul (UTC+3).
--
-- Retention: raw events are kept indefinitely. At current scale (~hundreds of
-- plan items across all users) this is a few thousand rows per year. Revisit
-- rolling older events into daily aggregates only past ~1M rows.

CREATE TABLE IF NOT EXISTS activity_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'plan_item',
  entity_id   TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  local_date  DATE NOT NULL,
  local_hour  SMALLINT NOT NULL,
  local_dow   SMALLINT NOT NULL,
  category    TEXT,
  duration    INTEGER,
  source      TEXT NOT NULL DEFAULT 'manual',
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_date
  ON activity_events (user_id, local_date);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_type
  ON activity_events (user_id, event_type, local_date);

CREATE INDEX IF NOT EXISTS idx_activity_events_entity
  ON activity_events (user_id, entity_id)
  WHERE entity_id IS NOT NULL;

-- Backfill: only plan_created, because plan_items.created_at is a real timestamp.
--
-- No synthetic plan_completed rows are generated: we do not know when an item was
-- actually completed, and inventing a time would produce false "you finish work at
-- 18:00" style insights. Time-of-day insights therefore filter on source <> 'backfill'
-- and start accumulating from the day this migration runs. Categorical and daily
-- totals are unaffected — those still read plan_items directly.
INSERT INTO activity_events (
  user_id, event_type, entity_type, entity_id, occurred_at,
  local_date, local_hour, local_dow, category, duration, source
)
SELECT
  p.user_id,
  'plan_created',
  CASE WHEN p.item_type = 'plan' THEN 'plan_item' ELSE p.item_type END,
  p.id,
  p.created_at,
  (p.created_at AT TIME ZONE u.timezone)::date,
  EXTRACT(HOUR FROM (p.created_at AT TIME ZONE u.timezone))::smallint,
  EXTRACT(DOW  FROM (p.created_at AT TIME ZONE u.timezone))::smallint,
  p.category,
  p.estimated_duration,
  'backfill'
FROM plan_items p
JOIN users u ON u.id = p.user_id;
