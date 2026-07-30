import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import type { ActivityEventType, ActivitySource } from "@gmd/shared";

export interface ActivityEventInput {
  eventType: ActivityEventType;
  entityId?: string | null;
  entityType?: string;
  category?: string | null;
  duration?: number | null;
  source?: ActivitySource;
  metadata?: Record<string, unknown>;
}

/**
 * Append one activity event.
 *
 * local_date/local_hour/local_dow are derived in SQL from the user's own
 * timezone, so the aggregation queries never have to convert and we avoid the
 * ISO-string off-by-one day bug for Istanbul (UTC+3).
 *
 * Like logAuditEvent, this is fire-and-forget: a logging failure must never
 * break the mutation the user actually asked for.
 */
export async function logActivityEvent(
  userId: string,
  input: ActivityEventInput,
  client?: PoolClient
): Promise<void> {
  try {
    const q = client ?? pool;
    await q.query(
      `INSERT INTO activity_events
         (user_id, event_type, entity_type, entity_id, category, duration, source, metadata,
          local_date, local_hour, local_dow)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8,
              (NOW() AT TIME ZONE u.timezone)::date,
              EXTRACT(HOUR FROM (NOW() AT TIME ZONE u.timezone))::smallint,
              EXTRACT(DOW  FROM (NOW() AT TIME ZONE u.timezone))::smallint
       FROM users u WHERE u.id = $1`,
      [
        userId,
        input.eventType,
        input.entityType ?? "plan_item",
        input.entityId ?? null,
        input.category ?? null,
        input.duration ?? null,
        input.source ?? "manual",
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch {
    // Activity logging is best-effort — never surface to the caller.
  }
}

/** Append the same event type for many entities in one statement. */
export async function logActivityEvents(
  userId: string,
  entityIds: string[],
  input: Omit<ActivityEventInput, "entityId">,
  client?: PoolClient
): Promise<void> {
  if (entityIds.length === 0) return;
  try {
    const q = client ?? pool;
    await q.query(
      `INSERT INTO activity_events
         (user_id, event_type, entity_type, entity_id, category, duration, source, metadata,
          local_date, local_hour, local_dow)
       SELECT $1, $2, $3, e.entity_id, $5, $6, $7, $8,
              (NOW() AT TIME ZONE u.timezone)::date,
              EXTRACT(HOUR FROM (NOW() AT TIME ZONE u.timezone))::smallint,
              EXTRACT(DOW  FROM (NOW() AT TIME ZONE u.timezone))::smallint
       FROM users u, UNNEST($4::text[]) AS e(entity_id)
       WHERE u.id = $1`,
      [
        userId,
        input.eventType,
        input.entityType ?? "plan_item",
        entityIds,
        input.category ?? null,
        input.duration ?? null,
        input.source ?? "manual",
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch {
    // Best-effort, same as above.
  }
}
