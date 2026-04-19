import { pool } from "../../db.js";

export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  projectId: string | null;
  issueId: string | null;
  actorName: string | null;
  message: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

function mapRow(r: any): UserNotification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    projectId: r.project_id ?? null,
    issueId: r.issue_id ?? null,
    actorName: r.actor_name ?? null,
    message: r.message,
    url: r.url ?? null,
    read: r.read,
    createdAt: r.created_at,
  };
}

export async function createUserNotification(data: {
  userId: string;
  type: string;
  projectId?: string | null;
  issueId?: string | null;
  actorName?: string | null;
  message: string;
  url?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO user_notifications (user_id, type, project_id, issue_id, actor_name, message, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.userId, data.type, data.projectId ?? null, data.issueId ?? null,
     data.actorName ?? null, data.message, data.url ?? null]
  );
}

export async function getUserNotifications(userId: string, limit = 30): Promise<UserNotification[]> {
  const { rows } = await pool.query(
    `SELECT * FROM user_notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map(mapRow);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS cnt FROM user_notifications WHERE user_id = $1 AND read = FALSE",
    [userId]
  );
  return rows[0]?.cnt ?? 0;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await pool.query(
    "UPDATE user_notifications SET read = TRUE WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query(
    "UPDATE user_notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE",
    [userId]
  );
}
