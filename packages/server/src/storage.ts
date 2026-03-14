import { pool } from "./db.js";
import type { DayLog, TaskEntry, PlanItem } from "@gmd/shared";

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
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    })) as TaskEntry[],
    plan: planResult.rows.map((r) => ({
      ...r,
      scheduledTime: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined,
    })) as PlanItem[],
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
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.duration !== undefined) { fields.push(`duration = $${idx++}`); values.push(updates.duration); }
  if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(updates.tags); }
  if (updates.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(updates.completed); }

  if (fields.length === 0) return null;

  values.push(taskId, userId);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, timestamp, description, category, duration, tags, completed`,
    values
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp } as TaskEntry;
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
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.estimatedDuration !== undefined) { fields.push(`estimated_duration = $${idx++}`); values.push(updates.estimatedDuration); }
  if (updates.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(updates.completed); }
  if (updates.order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(updates.order); }
  if (updates.scheduledTime !== undefined) { fields.push(`scheduled_time = $${idx++}`); values.push(updates.scheduledTime || null); }
  if (updates.actualDuration !== undefined) { fields.push(`actual_duration = $${idx++}`); values.push(updates.actualDuration); }

  if (fields.length === 0) return null;

  values.push(itemId, userId);
  const { rows } = await pool.query(
    `UPDATE plan_items SET ${fields.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING id, description, category, estimated_duration AS "estimatedDuration", completed, sort_order AS "order",
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration"`,
    values
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, scheduledTime: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined } as PlanItem;
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
  return rows.map((r) => ({
    ...r,
    scheduledTime: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined,
  })) as PlanItem[];
}

export async function movePlanItem(
  userId: string,
  itemId: string,
  newDate: string
): Promise<PlanItem | null> {
  // Get next sort_order for target date
  const { rows: orderRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM plan_items WHERE user_id = $1 AND date = $2",
    [userId, newDate]
  );
  const nextOrder = orderRows[0].next_order;

  const { rows } = await pool.query(
    `UPDATE plan_items SET date = $1, sort_order = $2
     WHERE id = $3 AND user_id = $4
     RETURNING id, description, category, estimated_duration AS "estimatedDuration", completed, sort_order AS "order",
               scheduled_time AS "scheduledTime", actual_duration AS "actualDuration"`,
    [newDate, nextOrder, itemId, userId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, scheduledTime: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined } as PlanItem;
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
  const r = rows[0];
  return { ...r, timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp } as TaskEntry;
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
      `SELECT COUNT(*)::int AS total_tasks, COALESCE(SUM(duration), 0)::int AS total_minutes
       FROM tasks WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [userId, from, to]
    ),
    // Count both tasks and plan items by category
    pool.query(
      `SELECT category, SUM(cnt)::int AS count, SUM(mins)::int AS minutes FROM (
         SELECT category, COUNT(*) AS cnt, COALESCE(SUM(duration), 0) AS mins
         FROM tasks WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY category
         UNION ALL
         SELECT category, COUNT(*) AS cnt, COALESCE(SUM(actual_duration), 0) AS mins
         FROM plan_items WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY category
       ) combined GROUP BY category`,
      [userId, from, to]
    ),
    pool.query(
      `SELECT
         d.date::date::text AS date,
         COALESCE(t.task_count, 0)::int AS tasks,
         COALESCE(p.plan_count, 0)::int AS planned,
         COALESCE(p.completed_count, 0)::int AS "completedPlan",
         COALESCE(t.total_minutes, 0)::int AS minutes
       FROM generate_series($2::date, $3::date, '1 day') AS d(date)
       LEFT JOIN (
         SELECT date, COUNT(*) AS task_count, SUM(duration) AS total_minutes
         FROM tasks WHERE user_id = $1
         GROUP BY date
       ) t ON t.date = d.date::date
       LEFT JOIN (
         SELECT date, COUNT(*) AS plan_count, COUNT(*) FILTER (WHERE completed) AS completed_count
         FROM plan_items WHERE user_id = $1
         GROUP BY date
       ) p ON p.date = d.date::date
       WHERE COALESCE(t.task_count, 0) > 0 OR COALESCE(p.plan_count, 0) > 0
       ORDER BY d.date`,
      [userId, from, to]
    ),
    // Streak: consecutive days with any activity (tasks or completed plans)
    pool.query(
      `WITH active_dates AS (
         SELECT DISTINCT date FROM tasks WHERE user_id = $1
         UNION
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
  for (const cat of ["dev", "meeting", "review", "ops", "learning", "personal", "other"]) {
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
