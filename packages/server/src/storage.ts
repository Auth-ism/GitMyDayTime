import { pool } from "./db.js";
import { Category, type DayLog, type TaskEntry, type PlanItem, type ChecklistItem, type RecurringTask, type CreateRecurringTaskInput, type UserProfile, type UpdateProfileInput } from "@gmd/shared";

// Helpers to normalize DB row types
function serializeTimestamp(val: unknown): string {
  return val instanceof Date ? val.toISOString() : String(val);
}

function formatTime(val: string | null | undefined): string | undefined {
  return val ? val.slice(0, 5) : undefined;
}

function toPlanItem(r: any): PlanItem {
  return { ...r, scheduledTime: formatTime(r.scheduledTime) } as PlanItem;
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
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    `SELECT id, email, username, display_name, bio, avatar_url, timezone, locale, theme,
            pomodoro_duration, break_duration, daily_goal, work_start_time, work_end_time,
            default_category, is_public, notification_enabled, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows.length > 0 ? toUserProfile(rows[0]) : null;
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
               default_category, is_public, notification_enabled, created_at`,
    values
  );

  return rows.length > 0 ? toUserProfile(rows[0]) : null;
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
              actual_duration AS "actualDuration"
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

  return {
    date,
    tasks: tasksResult.rows.map((r) => ({
      ...r,
      timestamp: serializeTimestamp(r.timestamp),
    })) as TaskEntry[],
    plan: planItems.map((p) => ({ ...p, checklist: checklistByPlan[p.id] || [] })),
  };
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
  return { ...rows[0], timestamp: serializeTimestamp(rows[0].timestamp) } as TaskEntry;
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
    [taskId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function addPlanItem(
  userId: string,
  date: string,
  item: PlanItem
): Promise<PlanItem> {
  await pool.query(
    `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order, scheduled_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [item.id, userId, date, item.description, item.category, item.duration ?? null, item.completed, item.order, item.scheduledTime ?? null]
  );
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
  });

  if (fields.length === 0) return null;

  let idx = nextIdx;
  values.push(itemId, userId);
  const { rows } = await pool.query(
    `UPDATE plan_items SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, description, category, estimated_duration AS "duration", completed, sort_order AS "order",
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration"`,
    values
  );

  return rows.length > 0 ? toPlanItem(rows[0]) : null;
}

export async function deletePlanItem(userId: string, itemId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM plan_items WHERE id = $1 AND user_id = $2",
    [itemId, userId]
  );
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
            actual_duration AS "actualDuration"
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
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration"`,
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
            actual_duration AS "actualDuration"
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
              actual_duration AS "actualDuration", date::text
       FROM plan_items WHERE user_id = $1 AND description ILIKE $2
       ORDER BY date DESC LIMIT $3`,
      [userId, pattern, limit]
    ),
    pool.query(
      `SELECT id, timestamp, description, category, duration, tags, completed, date::text
       FROM tasks WHERE user_id = $1 AND description ILIKE $2
       ORDER BY date DESC LIMIT $3`,
      [userId, pattern, limit]
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
  for (const cat of Category.options) {
    byCategory[cat] = { count: 0, minutes: 0 };
  }
  for (const row of byCategoryResult.rows) {
    byCategory[row.category] = { count: row.count, minutes: row.minutes };
  }

  return {
    totalTasks: totalsResult.rows[0].total_tasks,
    totalMinutes: totalsResult.rows[0].total_minutes,
    byCategory,
    dailyActivity: dailyResult.rows,
    streak: streakResult.rows[0].streak,
    daysTracked: dailyResult.rows.length,
  };
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
  const { rows } = await pool.query(
    `SELECT * FROM recurring_tasks WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows.map(toRecurringTask);
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

  return rows.length > 0 ? toRecurringTask(rows[0]) : null;
}

export async function deleteRecurringTask(userId: string, taskId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM recurring_tasks WHERE id = $1 AND user_id = $2",
    [taskId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function injectRecurringTasks(userId: string, date: string): Promise<PlanItem[]> {
  const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun, 6=Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Get active recurring tasks that match this day and haven't been injected yet
  const { rows: tasks } = await pool.query(
    `SELECT rt.* FROM recurring_tasks rt
     WHERE rt.user_id = $1 AND rt.active = true
       AND NOT EXISTS (
         SELECT 1 FROM recurring_task_instances rti
         WHERE rti.recurring_task_id = rt.id AND rti.date = $2
       )`,
    [userId, date]
  );

  const matching = tasks.filter((t: any) => {
    switch (t.recurrence) {
      case "daily": return true;
      case "weekdays": return isWeekday;
      case "weekly": return t.week_day === dayOfWeek;
      case "custom": return (t.custom_days || []).includes(dayOfWeek);
      default: return false;
    }
  });

  if (matching.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get next sort order
    const { rows: orderRows } = await client.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
      [userId, date]
    );
    let nextOrder = orderRows[0].next_order;

    const created: PlanItem[] = [];
    for (const task of matching) {
      const planId = `rec-${task.id}-${date}`;

      await client.query(
        `INSERT INTO plan_items (id, user_id, date, description, category, estimated_duration, completed, sort_order, scheduled_time)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
        [planId, userId, date, task.description, task.category, task.estimated_duration, nextOrder, task.scheduled_time]
      );

      await client.query(
        `INSERT INTO recurring_task_instances (recurring_task_id, date) VALUES ($1, $2)`,
        [task.id, date]
      );

      created.push({
        id: planId,
        description: task.description,
        category: task.category,
        duration: task.estimated_duration ?? undefined,
        completed: false,
        order: nextOrder,
        scheduledTime: formatTime(task.scheduled_time),
        checklist: [],
      });
      nextOrder++;
    }

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Plan Checklist ──────────────────────────────────────────────

export async function addChecklistItem(
  userId: string,
  planId: string,
  id: string,
  description: string
): Promise<ChecklistItem> {
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_checklist WHERE plan_id = $1 AND user_id = $2",
    [planId, userId]
  );
  const { rows } = await pool.query(
    `INSERT INTO plan_checklist (id, plan_id, user_id, description, completed, sort_order)
     VALUES ($1, $2, $3, $4, false, $5)
     RETURNING id, plan_id AS "planId", description, completed, sort_order AS "order"`,
    [id, planId, userId, description, orderRows[0].next_order]
  );
  return rows[0] as ChecklistItem;
}

export async function updateChecklistItem(
  userId: string,
  itemId: string,
  updates: Partial<Pick<ChecklistItem, "description" | "completed" | "order">>
): Promise<ChecklistItem | null> {
  const { fields, values, nextIdx } = buildDynamicUpdate(updates, {
    description: "description",
    completed: "completed",
    order: "sort_order",
  });
  if (fields.length === 0) return null;
  let idx = nextIdx;
  values.push(itemId, userId);
  const { rows } = await pool.query(
    `UPDATE plan_checklist SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, plan_id AS "planId", description, completed, sort_order AS "order"`,
    values
  );
  return rows.length > 0 ? (rows[0] as ChecklistItem) : null;
}

export async function deleteChecklistItem(
  userId: string,
  itemId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM plan_checklist WHERE id = $1 AND user_id = $2",
    [itemId, userId]
  );
  return (rowCount ?? 0) > 0;
}
