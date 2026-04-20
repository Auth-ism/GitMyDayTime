import { pool } from "../../db.js";
import crypto from "node:crypto";
import type { CalendarEvent } from "./ical.js";

export interface CalendarTokenRow {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  // 32 bytes -> 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

export async function listCalendarTokens(userId: string): Promise<CalendarTokenRow[]> {
  const { rows } = await pool.query(
    `SELECT id, created_at AS "createdAt", last_used_at AS "lastUsedAt"
     FROM user_calendar_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    lastUsedAt: r.lastUsedAt
      ? (r.lastUsedAt instanceof Date ? r.lastUsedAt.toISOString() : String(r.lastUsedAt))
      : null,
  }));
}

export async function createCalendarToken(userId: string): Promise<{ id: string; raw: string }> {
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const { rows } = await pool.query(
    `INSERT INTO user_calendar_tokens (user_id, token_hash)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, hash],
  );
  return { id: rows[0].id, raw };
}

export async function revokeCalendarToken(userId: string, tokenId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE user_calendar_tokens
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function resolveCalendarToken(raw: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!raw || raw.length < 32) return null;
  const hash = hashToken(raw);
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId"
     FROM user_calendar_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [hash],
  );
  if (rows.length === 0) return null;
  return { userId: rows[0].userId, tokenId: rows[0].id };
}

export async function touchCalendarToken(tokenId: string): Promise<void> {
  await pool.query(
    `UPDATE user_calendar_tokens SET last_used_at = NOW() WHERE id = $1`,
    [tokenId],
  ).catch(() => {});
}

// Window: past 30 days + future 90 days (keeps feed light + relevant)
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 90;

export interface CalendarEventSources {
  events: CalendarEvent[];
  lastModified: Date;
}

export async function getCalendarEvents(
  userId: string,
  username: string,
  appOrigin: string,
): Promise<CalendarEventSources> {
  const planResult = await pool.query(
    `SELECT id, date::text AS date, description, category,
            estimated_duration AS duration,
            scheduled_time::text AS "scheduledTime",
            completed, created_at AS "createdAt"
     FROM plan_items
     WHERE user_id = $1
       AND item_type IN ('plan', 'reminder')
       AND date BETWEEN (CURRENT_DATE - INTERVAL '${WINDOW_PAST_DAYS} days')
                    AND (CURRENT_DATE + INTERVAL '${WINDOW_FUTURE_DAYS} days')
     ORDER BY date, scheduled_time NULLS LAST`,
    [userId],
  );

  const issueResult = await pool.query(
    `SELECT i.id, i.issue_key AS "issueKey", i.title, i.due_date::text AS "dueDate",
            i.status_id AS "statusId", i.updated_at AS "updatedAt",
            ws.category AS "statusCategory", p.project_key AS "projectKey"
     FROM issues i
     JOIN workflow_statuses ws ON ws.id = i.status_id
     JOIN projects p ON p.id = i.project_id
     WHERE i.assignee_id = $1
       AND i.due_date IS NOT NULL
       AND i.archived = FALSE
       AND i.due_date BETWEEN (CURRENT_DATE - INTERVAL '${WINDOW_PAST_DAYS} days')
                           AND (CURRENT_DATE + INTERVAL '${WINDOW_FUTURE_DAYS} days')
     ORDER BY i.due_date`,
    [userId],
  );

  const events: CalendarEvent[] = [];
  let maxModified = new Date(0);

  for (const r of planResult.rows) {
    const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    if (created > maxModified) maxModified = created;

    const uid = `plan-${r.id}@gmd.byfeb.com`;
    if (r.scheduledTime) {
      const time = r.scheduledTime.slice(0, 5); // HH:MM
      const start = new Date(`${r.date}T${time}:00Z`);
      const durMin = Math.max(15, r.duration ?? 30);
      const end = new Date(start.getTime() + durMin * 60_000);
      events.push({
        uid,
        summary: r.description,
        description: r.category ? `Category: ${r.category}` : undefined,
        start,
        end,
        status: r.completed ? "CONFIRMED" : undefined,
      });
    } else {
      // All-day event
      const next = new Date(`${r.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      events.push({
        uid,
        summary: r.description,
        description: r.category ? `Category: ${r.category}` : undefined,
        start: { date: r.date },
        end: { date: next.toISOString().slice(0, 10) },
        status: r.completed ? "CONFIRMED" : undefined,
      });
    }
  }

  for (const r of issueResult.rows) {
    const updated = r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt);
    if (updated > maxModified) maxModified = updated;

    const next = new Date(`${r.dueDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    events.push({
      uid: `issue-${r.id}@gmd.byfeb.com`,
      summary: `[${r.issueKey}] ${r.title}`,
      description: `Due date for ${r.issueKey}`,
      start: { date: r.dueDate },
      end: { date: next.toISOString().slice(0, 10) },
      url: `${appOrigin}/issue/${r.id}`,
      status: r.statusCategory === "done" ? "CONFIRMED" : undefined,
    });
  }

  void username; // reserved for future per-user labels
  return { events, lastModified: maxModified.getTime() > 0 ? maxModified : new Date() };
}
