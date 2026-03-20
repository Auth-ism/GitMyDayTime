import { pool } from "./db.js";
import { nanoid } from "nanoid";
import { DEFAULT_CATEGORIES, type DayLog, type TaskEntry, type PlanItem, type ChecklistItem, type RecurringTask, type CreateRecurringTaskInput, type UserProfile, type UpdateProfileInput, type UserCategory, type PlanTemplate, type CreateTemplateInput } from "@gmd/shared";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, scheduleReminder, unscheduleReminder } from "./redis.js";

// Cache TTLs (seconds)
const TTL = {
  PROFILE: 900,     // 15 min
  DAYLOG: 300,      // 5 min
  CATEGORIES: 600,  // 10 min
  RECURRING: 600,   // 10 min
  STATS: 300,       // 5 min
};

// Cache invalidation helpers
export async function invalidateDayLog(userId: string, date: string): Promise<void> {
  await cacheDel(`daylog:${userId}:${date}`);
}
export async function invalidateStats(userId: string): Promise<void> {
  await cacheDelPattern(`stats:${userId}:*`);
}

// Helpers to normalize DB row types
function serializeTimestamp(val: unknown): string {
  return val instanceof Date ? val.toISOString() : String(val);
}

function formatTime(val: string | null | undefined): string | undefined {
  return val ? val.slice(0, 5) : undefined;
}

function toPlanItem(r: any): PlanItem {
  return {
    ...r,
    scheduledTime: formatTime(r.scheduledTime),
    notificationSent: r.notificationSent ?? false,
    priority: r.priority ?? "normal",
  } as PlanItem;
}

// ── User Profile ─────────────────────────────────────────────────

function toUserProfile(r: any): UserProfile {
  return {
    id: r.id,
    email: r.email,
    username: r.username,
    displayName: r.display_name ?? null,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    timezone: r.timezone,
    locale: r.locale,
    theme: r.theme,
    pomodoroDuration: r.pomodoro_duration,
    breakDuration: r.break_duration,
    dailyGoal: r.daily_goal ?? null,
    workStartTime: r.work_start_time ? r.work_start_time.slice(0, 5) : null,
    workEndTime: r.work_end_time ? r.work_end_time.slice(0, 5) : null,
    defaultCategory: r.default_category,
    isPublic: r.is_public,
    notificationEnabled: r.notification_enabled,
    phoneNumber: r.phone_number ?? null,
    smsNotifications: r.sms_notifications ?? false,
    emailNotifications: r.email_notifications ?? false,
    pushNotifications: r.push_notifications ?? false,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const cacheKey = `profile:${userId}`;
  const cached = await cacheGet<UserProfile>(cacheKey);
  if (cached) return cached;

  const { rows } = await pool.query(
    `SELECT id, email, username, display_name, bio, avatar_url, timezone, locale, theme,
            pomodoro_duration, break_duration, daily_goal, work_start_time, work_end_time,
            default_category, is_public, notification_enabled,
            phone_number, sms_notifications, email_notifications, push_notifications, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const profile = rows.length > 0 ? toUserProfile(rows[0]) : null;
  if (profile) await cacheSet(cacheKey, profile, TTL.PROFILE);
  return profile;
}

export async function updateUserProfile(
  userId: string,
  updates: UpdateProfileInput
): Promise<UserProfile | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    displayName: "display_name",
    bio: "bio",
    avatarUrl: "avatar_url",
    timezone: "timezone",
    locale: "locale",
    theme: "theme",
    pomodoroDuration: "pomodoro_duration",
    breakDuration: "break_duration",
    dailyGoal: "daily_goal",
    workStartTime: "work_start_time",
    workEndTime: "work_end_time",
    defaultCategory: "default_category",
    isPublic: "is_public",
    notificationEnabled: "notification_enabled",
    phoneNumber: "phone_number",
    smsNotifications: "sms_notifications",
    emailNotifications: "email_notifications",
    pushNotifications: "push_notifications",
    email: "email",
    username: "username",
  });

  if (fields.length === 0) return getUserProfile(userId);

  fields.push("updated_at = NOW()");
  values.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${nextIdx}
     RETURNING id, email, username, display_name, bio, avatar_url, timezone, locale, theme,
               pomodoro_duration, break_duration, daily_goal, work_start_time, work_end_time,
               default_category, is_public, notification_enabled,
               phone_number, sms_notifications, email_notifications, push_notifications, created_at`,
    values
  );

  const profile = rows.length > 0 ? toUserProfile(rows[0]) : null;
  if (profile) await cacheDel(`profile:${userId}`);
  return profile;
}

// Generic dynamic UPDATE builder
function buildDynamicUpdate(
  updates: Record<string, unknown>,
  fieldMap: Record<string, string>
): { fields: string[]; values: any[]; nextIdx: number } {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, dbCol] of Object.entries(fieldMap)) {
    if ((updates as any)[key] !== undefined) {
      fields.push(`${dbCol} = $${idx++}`);
      values.push((updates as any)[key]);
    }
  }
  return { fields, values, nextIdx: idx };
}

export async function getDayLog(userId: string, date: string): Promise<DayLog> {
  const cacheKey = `daylog:${userId}:${date}`;
  const cached = await cacheGet<DayLog>(cacheKey);
  if (cached) return cached;

  const [tasksResult, planResult] = await Promise.all([
    pool.query(
      `SELECT id, timestamp, description, category, duration, tags, completed
       FROM tasks WHERE user_id = $1 AND date = $2 ORDER BY timestamp`,
      [userId, date]
    ),
    pool.query(
      `SELECT id, description, category, estimated_duration AS "duration",
              completed, sort_order AS "order",
              scheduled_time AS "scheduledTime",
              actual_duration AS "actualDuration",
              item_type AS "itemType",
              notification_sent AS "notificationSent",
              priority
       FROM plan_items WHERE user_id = $1 AND date = $2 ORDER BY sort_order`,
      [userId, date]
    ),
  ]);

  const planItems = planResult.rows.map(toPlanItem);
  const planIds = planItems.map((p) => p.id);

  let checklistByPlan: Record<string, ChecklistItem[]> = {};
  if (planIds.length > 0) {
    const { rows: clRows } = await pool.query(
      `SELECT id, plan_id AS "planId", description, completed, sort_order AS "order"
       FROM plan_checklist WHERE plan_id = ANY($1) AND user_id = $2
       ORDER BY sort_order`,
      [planIds, userId]
    );
    for (const row of clRows) {
      const r = row as ChecklistItem;
      if (!checklistByPlan[r.planId]) checklistByPlan[r.planId] = [];
      checklistByPlan[r.planId].push(r);
    }
  }

  const dayLog: DayLog = {
    date,
    tasks: tasksResult.rows.map((r) => ({
      ...r,
      timestamp: serializeTimestamp(r.timestamp),
    })) as TaskEntry[],
    plan: planItems.map((p) => ({ ...p, checklist: checklistByPlan[p.id] || [] })),
  };
  await cacheSet(cacheKey, dayLog, TTL.DAYLOG);
  return dayLog;
}

export async function addTask(
  userId: string,
  date: string,
  task: TaskEntry
): Promise<TaskEntry> {
  await pool.query(
    `INSERT INTO tasks (id, user_id, date, timestamp, description, category, duration, tags, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [task.id, userId, date, task.timestamp, task.description, task.category, task.duration ?? null, task.tags, task.completed]
  );
  await invalidateDayLog(userId, date);
  return task;
}

export async function updateTask(
  userId: string,
  date: string,
  taskId: string,
  updates: Partial<TaskEntry>
): Promise<TaskEntry | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    description: "description",
    category: "category",
    duration: "duration",
    tags: "tags",
    completed: "completed",
  });

  if (fields.length === 0) return null;

  let idx = nextIdx;
  values.push(taskId, userId);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, timestamp, description, category, duration, tags, completed`,
    values
  );

  if (rows.length === 0) return null;
  await invalidateDayLog(userId, date);
  return { ...rows[0], timestamp: serializeTimestamp(rows[0].timestamp) } as TaskEntry;
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  // Get date before deleting for cache invalidation
  const { rows: dateRows } = await pool.query("SELECT date FROM tasks WHERE id = $1 AND user_id = $2", [taskId, userId]);
  const { rowCount } = await pool.query(
    "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
    [taskId, userId]
  );
  if (dateRows[0]) await invalidateDayLog(userId, dateRows[0].date);
  return (rowCount ?? 0) > 0;
}

export async function addPlanItem(
  userId: string,
  date: string,
  item: PlanItem
): Promise<PlanItem> {
  await pool.query(
    `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order, scheduled_time, item_type, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [item.id, userId, date, item.description, item.category, item.duration ?? null, item.completed, item.order, item.scheduledTime ?? null, item.itemType ?? "plan", item.priority ?? "normal"]
  );
  await invalidateDayLog(userId, date);
  await invalidateStats(userId);
  // Schedule reminder in Redis if it has a time
  if (item.scheduledTime && (item.itemType === "reminder" || item.itemType === "plan")) {
    const [h, m] = item.scheduledTime.split(":").map(Number);
    const fireDate = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    await scheduleReminder(userId, item.id, Math.floor(fireDate.getTime() / 1000));
  }
  return item;
}

export async function updatePlanItem(
  userId: string,
  itemId: string,
  updates: Partial<PlanItem>
): Promise<PlanItem | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    description: "description",
    category: "category",
    duration: "estimated_duration",
    completed: "completed",
    order: "sort_order",
    scheduledTime: "scheduled_time",
    actualDuration: "actual_duration",
    itemType: "item_type",
    priority: "priority",
  });

  if (fields.length === 0) return null;

  let idx = nextIdx;
  values.push(itemId, userId);
  const { rows } = await pool.query(
    `UPDATE plan_items SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, date, description, category, estimated_duration AS "duration", completed, sort_order AS "order",
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration",
               item_type AS "itemType", priority`,
    values
  );

  if (rows.length > 0) {
    await invalidateDayLog(userId, rows[0].date);
    if (updates.completed !== undefined || updates.actualDuration !== undefined) {
      await invalidateStats(userId);
    }
    const item = toPlanItem(rows[0]);
    delete (item as any).date;
    return item;
  }
  return null;
}

export async function deletePlanItem(userId: string, itemId: string): Promise<boolean> {
  const { rows: dateRows } = await pool.query("SELECT date FROM plan_items WHERE id = $1 AND user_id = $2", [itemId, userId]);
  const { rowCount } = await pool.query(
    "DELETE FROM plan_items WHERE id = $1 AND user_id = $2",
    [itemId, userId]
  );
  if (dateRows[0]) {
    await invalidateDayLog(userId, dateRows[0].date);
    await invalidateStats(userId);
  }
  await unscheduleReminder(userId, itemId);
  return (rowCount ?? 0) > 0;
}

export async function reorderPlanItems(
  userId: string,
  date: string,
  ids: string[]
): Promise<PlanItem[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        "UPDATE plan_items SET sort_order = $1 WHERE id = $2 AND user_id = $3 AND date = $4",
        [i, ids[i], userId, date]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(
    `SELECT id, description, category, estimated_duration AS "duration",
            completed, sort_order AS "order", scheduled_time AS "scheduledTime",
            actual_duration AS "actualDuration", item_type AS "itemType"
     FROM plan_items WHERE user_id = $1 AND date = $2 ORDER BY sort_order`,
    [userId, date]
  );
  return rows.map(toPlanItem);
}

export async function movePlanItem(
  userId: string,
  itemId: string,
  newDate: string
): Promise<PlanItem | null> {
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
    [userId, newDate]
  );

  const { rows } = await pool.query(
    `UPDATE plan_items SET date = $1, sort_order = $2
     WHERE id = $3 AND user_id = $4
     RETURNING id, description, category, estimated_duration AS "duration", completed, sort_order AS "order",
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration",
               item_type AS "itemType"`,
    [newDate, orderRows[0].next_order, itemId, userId]
  );

  return rows.length > 0 ? toPlanItem(rows[0]) : null;
}

export async function moveTask(
  userId: string,
  taskId: string,
  newDate: string
): Promise<TaskEntry | null> {
  const { rows } = await pool.query(
    `UPDATE tasks SET date = $1
     WHERE id = $2 AND user_id = $3
     RETURNING id, timestamp, description, category, duration, tags, completed`,
    [newDate, taskId, userId]
  );

  if (rows.length === 0) return null;
  return { ...rows[0], timestamp: serializeTimestamp(rows[0].timestamp) } as TaskEntry;
}

export async function getIncompleteItems(userId: string, date: string): Promise<PlanItem[]> {
  const { rows } = await pool.query(
    `SELECT id, description, category, estimated_duration AS "duration",
            completed, sort_order AS "order",
            scheduled_time AS "scheduledTime",
            actual_duration AS "actualDuration",
            item_type AS "itemType"
     FROM plan_items WHERE user_id = $1 AND date = $2 AND completed = false
     ORDER BY sort_order`,
    [userId, date]
  );
  return rows.map(toPlanItem);
}

export async function carryOverItems(userId: string, fromDate: string, toDate: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
      [userId, toDate]
    );
    const nextOrder = orderRows[0].next_order;

    const { rowCount } = await client.query(
      `UPDATE plan_items
       SET date = $1, sort_order = sort_order - (
         SELECT MIN(sort_order) FROM plan_items WHERE user_id = $3 AND date = $4 AND completed = false
       ) + $2
       WHERE user_id = $3 AND date = $4 AND completed = false`,
      [toDate, nextOrder, userId, fromDate]
    );

    await client.query("COMMIT");
    return rowCount ?? 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function searchItems(
  userId: string,
  query: string,
  limit: number = 50
): Promise<{
  plans: (PlanItem & { date: string })[];
  tasks: (TaskEntry & { date: string })[];
}> {
  const pattern = `%${query}%`;

  const [planResult, taskResult] = await Promise.all([
    pool.query(
      `SELECT id, description, category, estimated_duration AS "duration",
              completed, sort_order AS "order", scheduled_time AS "scheduledTime",
              actual_duration AS "actualDuration", item_type AS "itemType", date::text
       FROM plan_items WHERE user_id = $1 AND (description ILIKE $3 OR similarity(description, $2) > 0.15)
       ORDER BY similarity(description, $2) DESC, date DESC LIMIT $4`,
      [userId, query, pattern, limit]
    ),
    pool.query(
      `SELECT id, timestamp, description, category, duration, tags, completed, date::text
       FROM tasks WHERE user_id = $1 AND (description ILIKE $3 OR similarity(description, $2) > 0.15)
       ORDER BY similarity(description, $2) DESC, date DESC LIMIT $4`,
      [userId, query, pattern, limit]
    ),
  ]);

  return {
    plans: planResult.rows.map((r) => ({ ...toPlanItem(r), date: r.date })),
    tasks: taskResult.rows.map((r) => ({
      ...r,
      timestamp: serializeTimestamp(r.timestamp),
      date: r.date,
    })) as (TaskEntry & { date: string })[],
  };
}

export async function getStats(
  userId: string,
  from: string,
  to: string
): Promise<{
  totalTasks: number;
  totalMinutes: number;
  byCategory: Record<string, { count: number; minutes: number }>;
  dailyActivity: { date: string; tasks: number; planned: number; completedPlan: number; minutes: number }[];
  streak: number;
  daysTracked: number;
}> {
  const cacheKey = `stats:${userId}:${from}:${to}`;
  const cached = await cacheGet<Awaited<ReturnType<typeof getStats>>>(cacheKey);
  if (cached) return cached;

  const [totalsResult, byCategoryResult, dailyResult, streakResult] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM plan_items WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND completed = true)
         AS total_tasks,
         COALESCE((SELECT SUM(actual_duration) FROM plan_items WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND completed = true), 0)::int
         AS total_minutes`,
      [userId, from, to]
    ),
    pool.query(
      `SELECT category, COUNT(*)::int AS count, COALESCE(SUM(actual_duration), 0)::int AS minutes
       FROM plan_items WHERE user_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY category`,
      [userId, from, to]
    ),
    pool.query(
      `SELECT
         d.date::date::text AS date,
         COALESCE(p.completed_count, 0)::int AS tasks,
         COALESCE(p.plan_count, 0)::int AS planned,
         COALESCE(p.completed_count, 0)::int AS "completedPlan",
         COALESCE(p.total_minutes, 0)::int AS minutes
       FROM generate_series($2::date, $3::date, '1 day') AS d(date)
       LEFT JOIN (
         SELECT date,
                COUNT(*) AS plan_count,
                COUNT(*) FILTER (WHERE completed) AS completed_count,
                COALESCE(SUM(actual_duration) FILTER (WHERE completed), 0) AS total_minutes
         FROM plan_items WHERE user_id = $1
         GROUP BY date
       ) p ON p.date = d.date::date
       WHERE COALESCE(p.plan_count, 0) > 0
       ORDER BY d.date`,
      [userId, from, to]
    ),
    pool.query(
      `WITH active_dates AS (
         SELECT DISTINCT date FROM plan_items WHERE user_id = $1 AND completed = true
       ),
       numbered AS (
         SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
         FROM active_dates
       ),
       streaks AS (
         SELECT grp, MIN(date) AS start_date, MAX(date) AS end_date, COUNT(*)::int AS length
         FROM numbered GROUP BY grp
       )
       SELECT COALESCE(
         (SELECT length FROM streaks WHERE end_date >= CURRENT_DATE - 1 ORDER BY end_date DESC LIMIT 1),
         0
       )::int AS streak`,
      [userId]
    ),
  ]);

  const byCategory: Record<string, { count: number; minutes: number }> = {};
  for (const cat of DEFAULT_CATEGORIES) {
    byCategory[cat] = { count: 0, minutes: 0 };
  }
  for (const row of byCategoryResult.rows) {
    byCategory[row.category] = { count: row.count, minutes: row.minutes };
  }

  const result = {
    totalTasks: totalsResult.rows[0].total_tasks,
    totalMinutes: totalsResult.rows[0].total_minutes,
    byCategory,
    dailyActivity: dailyResult.rows,
    streak: streakResult.rows[0].streak,
    daysTracked: dailyResult.rows.length,
  };
  await cacheSet(cacheKey, result, TTL.STATS);
  return result;
}

// ── Recurring Tasks ──────────────────────────────────────────────

function toRecurringTask(r: any): RecurringTask {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    duration: r.estimated_duration ?? undefined,
    scheduledTime: formatTime(r.scheduled_time),
    recurrence: r.recurrence,
    weekDay: r.week_day ?? undefined,
    customDays: r.custom_days ?? [],
    active: r.active,
    createdAt: r.created_at ? serializeTimestamp(r.created_at) : undefined,
  };
}

export async function getRecurringTasks(userId: string): Promise<RecurringTask[]> {
  const cacheKey = `recurring:${userId}`;
  const cached = await cacheGet<RecurringTask[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await pool.query(
    `SELECT * FROM recurring_tasks WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  const tasks = rows.map(toRecurringTask);
  await cacheSet(cacheKey, tasks, TTL.RECURRING);
  return tasks;
}

export async function createRecurringTask(
  userId: string,
  id: string,
  input: CreateRecurringTaskInput
): Promise<RecurringTask> {
  const { rows } = await pool.query(
    `INSERT INTO recurring_tasks (id, user_id, description, category, estimated_duration, scheduled_time, recurrence, week_day, custom_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id, userId, input.description, input.category, input.duration ?? null, input.scheduledTime ?? null, input.recurrence, input.weekDay ?? null, input.customDays ?? []]
  );
  await cacheDel(`recurring:${userId}`);
  return toRecurringTask(rows[0]);
}

export async function updateRecurringTask(
  userId: string,
  taskId: string,
  updates: Partial<CreateRecurringTaskInput> & { active?: boolean }
): Promise<RecurringTask | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    description: "description",
    category: "category",
    duration: "estimated_duration",
    scheduledTime: "scheduled_time",
    recurrence: "recurrence",
    weekDay: "week_day",
    customDays: "custom_days",
    active: "active",
  });

  if (fields.length === 0) return null;

  let idx = nextIdx;
  values.push(taskId, userId);
  const { rows } = await pool.query(
    `UPDATE recurring_tasks SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING *`,
    values
  );

  if (rows.length > 0) {
    await cacheDel(`recurring:${userId}`);
    return toRecurringTask(rows[0]);
  }
  return null;
}

export async function deleteRecurringTask(userId: string, taskId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM recurring_tasks WHERE id = $1 AND user_id = $2",
    [taskId, userId]
  );
  if ((rowCount ?? 0) > 0) await cacheDel(`recurring:${userId}`);
  return (rowCount ?? 0) > 0;
}

export async function injectRecurringTasks(userId: string, date: string): Promise<PlanItem[]> {
  try {
    // Get active recurring tasks
    const { rows: tasks } = await pool.query(
      `SELECT * FROM recurring_tasks WHERE user_id = $1 AND active = TRUE`,
      [userId]
    );
    if (tasks.length === 0) return [];

    // Check which day of week this date falls on (0=Sun, 6=Sat)
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    // Filter tasks that should run on this day
    const applicable = tasks.filter((t: any) => {
      switch (t.recurrence) {
        case "daily": return true;
        case "weekdays": return dayOfWeek >= 1 && dayOfWeek <= 5;
        case "weekly": return t.week_day === dayOfWeek;
        case "custom": return (t.custom_days || []).includes(dayOfWeek);
        default: return false;
      }
    });
    if (applicable.length === 0) return [];

    // Check which tasks already injected for this date
    const taskIds = applicable.map((t: any) => t.id);
    const { rows: existing } = await pool.query(
      `SELECT recurring_task_id FROM recurring_task_instances WHERE recurring_task_id = ANY($1) AND date = $2`,
      [taskIds, date]
    );
    const alreadyInjected = new Set(existing.map((r: any) => r.recurring_task_id));

    // Get current max order for plan items
    const { rows: orderRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    let nextOrder = orderRows[0].next_order;

    const created: PlanItem[] = [];
    for (const task of applicable) {
      if (alreadyInjected.has(task.id)) continue;

      const planId = nanoid(8);
      const { rows } = await pool.query(
        `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, scheduled_time, completed, sort_order, item_type, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, 'plan', 'normal')
         RETURNING id, description, category, estimated_duration AS duration, completed, sort_order AS "order",
                   scheduled_time AS "scheduledTime", item_type AS "itemType", priority`,
        [planId, userId, date, task.description, task.category, task.estimated_duration, task.scheduled_time, nextOrder++]
      );

      // Mark as injected
      await pool.query(
        `INSERT INTO recurring_task_instances (recurring_task_id, date) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [task.id, date]
      );

      created.push({ ...rows[0], checklist: [], tags: [] } as PlanItem);
    }

    return created;
  } catch (error) {
    console.error("Error in injectRecurringTasks:", error);
    return [];
  }
}

// ŞİMDİ DİĞER FONKSİYONLAR BAŞLIYOR (Artık hata vermeyecekler)

export async function addChecklistItem(
  userId: string,
  planItemId: string,
  content: string
): Promise<ChecklistItem> {
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_checklist WHERE plan_id = $1 AND user_id = $2",
    [planItemId, userId]
  );
  const { rows } = await pool.query(
    `INSERT INTO plan_checklist (id, plan_id, user_id, description, completed, sort_order)
     VALUES ($1, $2, $3, $4, false, $5)
     RETURNING id, plan_id AS "planId", description, completed, sort_order AS "order"`,
    [nanoid(10), planItemId, userId, content, orderRows[0].next_order]
  );
  return rows[0] as ChecklistItem;
}

export async function updateChecklistItem(
  userId: string,
  itemId: string,
  updates: Partial<ChecklistItem> & { content?: string; isCompleted?: boolean }
): Promise<ChecklistItem | null> {
  const normalized = {
    description: updates.description ?? updates.content,
    completed: updates.completed ?? updates.isCompleted,
    order: updates.order,
  };

  const { fields, values, nextIdx } = buildDynamicUpdate(normalized, {
    description: "description",
    completed: "completed",
    order: "sort_order",
  });
  if (fields.length === 0) return null;

  values.push(itemId, userId);
  const { rows } = await pool.query(
    `UPDATE plan_checklist SET ${fields.join(", ")} WHERE id = $${nextIdx} AND user_id = $${nextIdx + 1}
     RETURNING id, plan_id AS "planId", description, completed, sort_order AS "order"`,
    values
  );
  return (rows[0] as ChecklistItem) || null;
}

export async function deleteChecklistItem(userId: string, itemId: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM plan_checklist WHERE id = $1 AND user_id = $2", [itemId, userId]);
  return (rowCount ?? 0) > 0;
}

export async function getUserCategories(userId: string): Promise<UserCategory[]> {
  const cacheKey = `categories:${userId}`;
  const cached = await cacheGet<UserCategory[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await pool.query(
    "SELECT id, name, color, sort_order AS \"sortOrder\" FROM user_categories WHERE user_id = $1 ORDER BY sort_order ASC",
    [userId]
  );
  const cats = rows as UserCategory[];
  await cacheSet(cacheKey, cats, TTL.CATEGORIES);
  return cats;
}

export async function createUserCategory(
  userId: string,
  id: string,
  name: string,
  color: string
): Promise<UserCategory> {
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM user_categories WHERE user_id = $1",
    [userId]
  );
  const { rows } = await pool.query(
    `INSERT INTO user_categories (id, user_id, name, color, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, color, sort_order AS "sortOrder"`,
    [id, userId, name, color, orderRows[0].next_order]
  );
  await cacheDel(`categories:${userId}`);
  return rows[0] as UserCategory;
}

export async function updateUserCategory(
  userId: string,
  categoryId: string,
  updates: { name?: string; color?: string }
): Promise<UserCategory | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    name: "name",
    color: "color",
  });
  if (fields.length === 0) return null;
  let idx = nextIdx;
  values.push(categoryId, userId);
  const { rows } = await pool.query(
    `UPDATE user_categories SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, name, color, sort_order AS "sortOrder"`,
    values
  );
  if (rows.length > 0) await cacheDel(`categories:${userId}`);
  return rows.length > 0 ? (rows[0] as UserCategory) : null;
}

export async function deleteUserCategory(userId: string, categoryId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM user_categories WHERE id = $1 AND user_id = $2",
    [categoryId, userId]
  );
  if ((rowCount ?? 0) > 0) await cacheDel(`categories:${userId}`);
  return (rowCount ?? 0) > 0;
}

// ── Notification Scheduler ───────────────────────────────────────

export interface PendingNotification {
  id: string;
  description: string;
  itemType: string;
  scheduledTime: string;
  userId: string;
  email: string;
  phoneNumber: string | null;
  smsNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  pushSubscription: any;
  timezone: string;
}

export async function getPendingNotifications(): Promise<PendingNotification[]> {
  const { rows } = await pool.query(
    `SELECT pi.id, pi.description, pi.item_type AS "itemType",
            TO_CHAR(pi.scheduled_time, 'HH24:MI') AS "scheduledTime",
            u.id AS "userId", u.email,
            u.phone_number AS "phoneNumber",
            u.sms_notifications AS "smsNotifications",
            u.email_notifications AS "emailNotifications",
            u.push_notifications AS "pushNotifications",
            u.push_subscription AS "pushSubscription",
            COALESCE(u.timezone, 'UTC') AS timezone
     FROM plan_items pi
     JOIN users u ON u.id = pi.user_id
     WHERE pi.notification_sent = FALSE
       AND pi.scheduled_time IS NOT NULL
       AND (u.sms_notifications = TRUE OR u.email_notifications = TRUE OR u.push_notifications = TRUE)
       AND pi.date = (NOW() AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
       AND TO_CHAR(NOW() AT TIME ZONE COALESCE(u.timezone, 'UTC'), 'HH24:MI')
           = TO_CHAR(pi.scheduled_time, 'HH24:MI')`
  );
  return rows as PendingNotification[];
}

export async function markNotificationSent(id: string): Promise<void> {
  await pool.query(
    "UPDATE plan_items SET notification_sent = TRUE WHERE id = $1",
    [id]
  );
}

// ── Daily Journal ─────────────────────────────────────────────────

export async function getJournal(userId: string, date: string): Promise<string> {
  const { rows } = await pool.query(
    "SELECT content FROM daily_journals WHERE user_id = $1 AND date = $2",
    [userId, date]
  );
  return rows[0]?.content ?? "";
}

export async function upsertJournal(userId: string, date: string, content: string): Promise<void> {
  await pool.query(
    `INSERT INTO daily_journals (id, user_id, date, content, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, date) DO UPDATE SET content = $4, updated_at = NOW()`,
    [nanoid(8), userId, date, content]
  );
}

// ── Plan Templates ───────────────────────────────────────────────

export async function getTemplates(userId: string): Promise<PlanTemplate[]> {
  const { rows: tmpl } = await pool.query(
    "SELECT id, name, created_at FROM plan_templates WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  if (tmpl.length === 0) return [];
  const templateIds = tmpl.map((t: any) => t.id);
  const { rows: items } = await pool.query(
    `SELECT id, template_id AS "templateId", description, category, estimated_duration AS duration,
            scheduled_time AS "scheduledTime", priority, sort_order AS "order"
     FROM template_items WHERE template_id = ANY($1) ORDER BY sort_order`,
    [templateIds]
  );
  const byTemplate: Record<string, any[]> = {};
  for (const item of items) {
    if (!byTemplate[item.templateId]) byTemplate[item.templateId] = [];
    byTemplate[item.templateId].push({ ...item, scheduledTime: formatTime(item.scheduledTime) });
  }
  return tmpl.map((t: any) => ({
    id: t.id,
    name: t.name,
    items: (byTemplate[t.id] || []).map((i: any) => ({ ...i, duration: i.duration ?? undefined })),
    createdAt: serializeTimestamp(t.created_at),
  }));
}

export async function createTemplate(userId: string, input: CreateTemplateInput): Promise<PlanTemplate> {
  const id = nanoid(8);
  await pool.query(
    "INSERT INTO plan_templates (id, user_id, name) VALUES ($1, $2, $3)",
    [id, userId, input.name]
  );
  const items: PlanTemplate["items"] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const itemId = nanoid(8);
    await pool.query(
      `INSERT INTO template_items (id, template_id, description, category, estimated_duration, scheduled_time, priority, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [itemId, id, item.description, item.category, item.duration ?? null, item.scheduledTime ?? null, item.priority ?? "normal", i]
    );
    items.push({
      id: itemId,
      templateId: id,
      description: item.description,
      category: item.category ?? "other",
      duration: item.duration,
      scheduledTime: item.scheduledTime,
      priority: (item.priority ?? "normal") as "urgent" | "high" | "normal",
      order: i,
    });
  }
  const { rows } = await pool.query("SELECT created_at FROM plan_templates WHERE id = $1", [id]);
  return { id, name: input.name, items, createdAt: serializeTimestamp(rows[0].created_at) };
}

export async function deleteTemplate(userId: string, templateId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM plan_templates WHERE id = $1 AND user_id = $2",
    [templateId, userId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Copy Day Plans ───────────────────────────────────────────────

export async function copyDayPlans(userId: string, fromDate: string, toDate: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT description, category, estimated_duration, scheduled_time, item_type, priority
     FROM plan_items WHERE user_id = $1 AND date = $2 AND item_type = 'plan'
     ORDER BY sort_order`,
    [userId, fromDate]
  );
  if (rows.length === 0) return 0;
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
    [userId, toDate]
  );
  let nextOrder = orderRows[0].next_order;
  for (const row of rows) {
    await pool.query(
      `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order, scheduled_time, item_type, priority)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10)`,
      [nanoid(8), userId, toDate, row.description, row.category, row.estimated_duration, nextOrder++, row.scheduled_time, row.item_type, row.priority ?? "normal"]
    );
  }
  return rows.length;
}

// ── Export User Data ─────────────────────────────────────────────

export async function exportUserData(userId: string): Promise<object> {
  const [planItems, tasks, recurring, journals] = await Promise.all([
    pool.query(
      `SELECT date::text, description, category, estimated_duration AS duration, actual_duration AS "actualDuration",
              completed, scheduled_time AS "scheduledTime", item_type AS "itemType", priority
       FROM plan_items WHERE user_id = $1 ORDER BY date, sort_order`,
      [userId]
    ),
    pool.query(
      `SELECT date::text, description, category, duration, completed, timestamp
       FROM tasks WHERE user_id = $1 ORDER BY date, timestamp`,
      [userId]
    ),
    pool.query(
      "SELECT description, category, recurrence, scheduled_time AS \"scheduledTime\", active FROM recurring_tasks WHERE user_id = $1",
      [userId]
    ),
    pool.query(
      "SELECT date::text, content FROM daily_journals WHERE user_id = $1 ORDER BY date",
      [userId]
    ),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    plans: planItems.rows,
    tasks: tasks.rows,
    recurringTasks: recurring.rows,
    journals: journals.rows,
  };
}

export async function importUserData(
  userId: string,
  data: { plans: any[]; tasks: any[]; recurringTasks?: any[]; journals?: any[] }
): Promise<{ plans: number; tasks: number; recurringTasks: number; journals: number }> {
  const client = await pool.connect();
  const counts = { plans: 0, tasks: 0, recurringTasks: 0, journals: 0 };

  try {
    await client.query("BEGIN");

    // Import plans
    for (const plan of data.plans) {
      const id = nanoid(8);
      // Calculate next sort_order for this date
      const { rows: orderRows } = await client.query(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
        [userId, plan.date]
      );
      const sortOrder = orderRows[0].next_order;
      await client.query(
        `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order, scheduled_time, item_type, priority, actual_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id, userId, plan.date, plan.description,
          plan.category || "general", plan.duration || null,
          plan.completed || false, sortOrder,
          plan.scheduledTime || null, plan.itemType || "plan",
          plan.priority || "normal", plan.actualDuration || null,
        ]
      );
      counts.plans++;
    }

    // Import tasks
    for (const task of data.tasks) {
      const id = nanoid(8);
      await client.query(
        `INSERT INTO tasks (id, user_id, date, description, category, duration, completed, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id, userId, task.date, task.description,
          task.category || "general", task.duration || null,
          task.completed || false, task.timestamp || new Date().toISOString(),
        ]
      );
      counts.tasks++;
    }

    // Import recurring tasks (skip duplicates by description)
    if (data.recurringTasks) {
      for (const rt of data.recurringTasks) {
        const { rows: existing } = await client.query(
          "SELECT id FROM recurring_tasks WHERE user_id = $1 AND description = $2",
          [userId, rt.description]
        );
        if (existing.length > 0) continue;
        const id = nanoid(8);
        await client.query(
          `INSERT INTO recurring_tasks (id, user_id, description, category, recurrence, scheduled_time, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id, userId, rt.description,
            rt.category || "general", rt.recurrence || "daily",
            rt.scheduledTime || null, rt.active !== false,
          ]
        );
        counts.recurringTasks++;
      }
    }

    // Import journals (upsert)
    if (data.journals) {
      for (const journal of data.journals) {
        await client.query(
          `INSERT INTO daily_journals (user_id, date, content)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, date) DO UPDATE SET content = EXCLUDED.content`,
          [userId, journal.date, journal.content]
        );
        counts.journals++;
      }
    }

    await client.query("COMMIT");
    return counts;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Web Push ─────────────────────────────────────────────────────

export async function savePushSubscription(userId: string, subscription: object | null): Promise<void> {
  await pool.query(
    "UPDATE users SET push_subscription = $1 WHERE id = $2",
    [subscription ? JSON.stringify(subscription) : null, userId]
  );
}

export async function getUsersWithPushSubscriptions(): Promise<{ id: string; pushSubscription: any; timezone: string }[]> {
  const { rows } = await pool.query(
    "SELECT id, push_subscription AS \"pushSubscription\", timezone FROM users WHERE push_subscription IS NOT NULL AND push_notifications = TRUE"
  );
  return rows;
}

// ── Yearly Activity (Heatmap) ─────────────────────────────────────

export async function getYearlyActivity(userId: string): Promise<{ date: string; count: number }[]> {
  const { rows } = await pool.query(
    `SELECT date::text, COUNT(*)::int AS count
     FROM plan_items
     WHERE user_id = $1
       AND completed = true
       AND date >= CURRENT_DATE - INTERVAL '365 days'
     GROUP BY date
     ORDER BY date`,
    [userId]
  );
  return rows as { date: string; count: number }[];
}

// ── Category Completion Rates ─────────────────────────────────────

export async function getCategoryCompletionRates(userId: string, from: string, to: string): Promise<Record<string, { total: number; completed: number }>> {
  const { rows } = await pool.query(
    `SELECT category,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE completed)::int AS completed
     FROM plan_items WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND item_type = 'plan'
     GROUP BY category`,
    [userId, from, to]
  );
  const result: Record<string, { total: number; completed: number }> = {};
  for (const row of rows) {
    result[row.category] = { total: row.total, completed: row.completed };
  }
  return result;
}

// ── Estimate vs Actual Accuracy ───────────────────────────────────

export async function getEstimateAccuracy(userId: string, from: string, to: string): Promise<{ avgEstimate: number; avgActual: number; count: number }> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(AVG(estimated_duration), 0)::int AS "avgEstimate",
       COALESCE(AVG(actual_duration), 0)::int AS "avgActual",
       COUNT(*)::int AS count
     FROM plan_items
     WHERE user_id = $1 AND date BETWEEN $2 AND $3
       AND completed = true
       AND estimated_duration IS NOT NULL
       AND actual_duration IS NOT NULL`,
    [userId, from, to]
  );
  return rows[0] as { avgEstimate: number; avgActual: number; count: number };
}
