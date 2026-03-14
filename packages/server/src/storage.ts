import { pool } from "./db.js";
import { Category, type DayLog, type TaskEntry, type PlanItem } from "@gmd/shared";

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
      `SELECT id, description, category, estimated_duration AS "estimatedDuration",
              completed, sort_order AS "order",
              scheduled_time AS "scheduledTime",
              actual_duration AS "actualDuration"
       FROM plan_items WHERE user_id = $1 AND date = $2 ORDER BY sort_order`,
      [userId, date]
    ),
  ]);

  return {
    date,
    tasks: tasksResult.rows.map((r) => ({
      ...r,
      timestamp: serializeTimestamp(r.timestamp),
    })) as TaskEntry[],
    plan: planResult.rows.map(toPlanItem),
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
    [item.id, userId, date, item.description, item.category, item.estimatedDuration ?? null, item.completed, item.order, item.scheduledTime ?? null]
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
    estimatedDuration: "estimated_duration",
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
     RETURNING id, description, category, estimated_duration AS "estimatedDuration", completed, sort_order AS "order",
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
    `SELECT id, description, category, estimated_duration AS "estimatedDuration",
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
     RETURNING id, description, category, estimated_duration AS "estimatedDuration", completed, sort_order AS "order",
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
