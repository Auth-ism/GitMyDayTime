import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { pool } from "../db.js";
import {
  cacheGet, cacheSet, cacheDel, cacheDelPattern, isRedisConnected, redis,
} from "../redis.js";
import type {
  Project, ProjectMember, ProjectRole, WorkflowStatus,
  Issue, IssueComment, IssueHistory, IssueDetail, IssueLink,
  BoardData, BoardColumn,
} from "@gmd/shared";

// ─────────────────────────────────────────────────────────────────
// TTL constants
// ─────────────────────────────────────────────────────────────────
const MEMBER_ROLE_TTL = 300;   // 5 min
const MEMBER_MISSING_TTL = 30; // 30s for "not a member" to avoid thundering herd
const BOARD_TTL = 20;          // 20s active board
const ISSUE_TTL = 120;         // 2 min issue detail
const INVITE_TTL = 7 * 24 * 3600; // 7 days

// ─────────────────────────────────────────────────────────────────
// Role helpers
// ─────────────────────────────────────────────────────────────────
export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer:    1,
  reporter:  2,
  developer: 3,
  admin:     4,
  owner:     5,
};

export async function getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const key = `gmd:pm:member:${projectId}:${userId}`;
  const cached = await cacheGet<string>(key);
  if (cached !== null) return (cached || null) as ProjectRole | null;

  const { rows } = await pool.query(
    "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
    [projectId, userId]
  );
  const role = rows[0]?.role ?? null;
  await cacheSet(key, role ?? "", role ? MEMBER_ROLE_TTL : MEMBER_MISSING_TTL);
  return role;
}

export async function invalidateMemberCache(projectId: string, userId: string): Promise<void> {
  await cacheDel(`gmd:pm:member:${projectId}:${userId}`);
}

export async function invalidateAllMemberCaches(projectId: string): Promise<void> {
  await cacheDelPattern(`gmd:pm:member:${projectId}:*`);
}

// ─────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────
function rowToProject(r: any): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    projectKey: r.project_key,
    boardType: r.board_type,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    memberCount: r.member_count ? Number(r.member_count) : undefined,
    myRole: r.my_role ?? undefined,
  };
}

function rowToMember(r: any): ProjectMember {
  return {
    projectId: r.project_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    username: r.username ?? undefined,
    displayName: r.display_name ?? null,
    avatarUrl: r.avatar_url ?? null,
    email: r.email ?? undefined,
  };
}

function rowToStatus(r: any): WorkflowStatus {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    color: r.color,
    category: r.category,
    sortOrder: r.sort_order,
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

function rowToIssue(r: any): Issue {
  return {
    id: r.id,
    projectId: r.project_id,
    issueNumber: r.issue_number,
    issueKey: r.issue_key,
    title: r.title,
    description: r.description ?? null,
    issueType: r.issue_type,
    statusId: r.status_id,
    priority: r.priority,
    labels: r.labels ?? [],
    parentId: r.parent_id ?? null,
    epicId: r.epic_id ?? null,
    assigneeId: r.assignee_id ?? null,
    reporterId: r.reporter_id,
    dueDate: r.due_date ?? null,
    estimatedHours: r.estimated_hours != null ? Number(r.estimated_hours) : null,
    loggedHours: Number(r.logged_hours ?? 0),
    sprintId: r.sprint_id ?? null,
    customFields: r.custom_fields ?? {},
    sortOrder: r.sort_order ?? 0,
    planItemId: r.plan_item_id ?? null,
    storyPoints: r.story_points ?? null,
    notificationSent: r.notification_sent ?? false,
    resolvedAt: r.resolved_at ?? null,
    archived: r.archived ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    statusName: r.status_name ?? undefined,
    statusColor: r.status_color ?? undefined,
    statusCategory: r.status_category ?? undefined,
    assigneeUsername: r.assignee_username ?? null,
    assigneeDisplayName: r.assignee_display_name ?? null,
    assigneeAvatarUrl: r.assignee_avatar_url ?? null,
    reporterUsername: r.reporter_username ?? undefined,
    parentIssueKey: r.parent_issue_key ?? null,
    parentTitle: r.parent_title ?? null,
  };
}

function rowToComment(r: any): IssueComment {
  return {
    id: r.id,
    issueId: r.issue_id,
    authorId: r.author_id,
    content: r.content,
    mentions: r.mentions ?? [],
    editedAt: r.edited_at ?? null,
    createdAt: r.created_at,
    authorUsername: r.author_username ?? undefined,
    authorDisplayName: r.author_display_name ?? null,
    authorAvatarUrl: r.author_avatar_url ?? null,
  };
}

function rowToHistory(r: any): IssueHistory {
  return {
    id: r.id,
    issueId: r.issue_id,
    changedBy: r.changed_by,
    fieldName: r.field_name,
    oldValue: r.old_value ?? null,
    newValue: r.new_value ?? null,
    changedAt: r.changed_at,
    changedByUsername: r.changed_by_username ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────
const DEFAULT_STATUSES = [
  { name: "Yapılacak",    category: "todo",        is_default: true,  sort_order: 0, color: "#6b7280" },
  { name: "Devam Ediyor", category: "in_progress", is_default: false, sort_order: 1, color: "#3b82f6" },
  { name: "İnceleme",     category: "in_progress", is_default: false, sort_order: 2, color: "#f59e0b" },
  { name: "Tamamlandı",   category: "done",        is_default: false, sort_order: 3, color: "#10b981" },
];

export async function createProject(
  userId: string,
  data: { name: string; projectKey: string; description?: string; boardType: "kanban" | "scrum" }
): Promise<Project> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO projects (name, description, project_key, board_type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.description ?? null, data.projectKey, data.boardType, userId]
    );
    const project = rows[0];

    // Owner membership
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [project.id, userId]
    );

    // Seed counter
    await client.query(
      `INSERT INTO project_issue_counters (project_id) VALUES ($1)`,
      [project.id]
    );

    // Seed default workflow statuses
    for (const s of DEFAULT_STATUSES) {
      await client.query(
        `INSERT INTO workflow_statuses (project_id, name, color, category, sort_order, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [project.id, s.name, s.color, s.category, s.sort_order, s.is_default]
      );
    }

    await client.query("COMMIT");
    return rowToProject({ ...project, member_count: 1, my_role: "owner" });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const { rows } = await pool.query(
    `SELECT p.*,
            COUNT(pm2.user_id) AS member_count,
            pm.role AS my_role
     FROM projects p
     JOIN project_members pm  ON pm.project_id = p.id AND pm.user_id = $1
     JOIN project_members pm2 ON pm2.project_id = p.id
     GROUP BY p.id, pm.role
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows.map(rowToProject);
}

export async function getProject(projectId: string, userId: string): Promise<
  (Project & { members: ProjectMember[]; statuses: WorkflowStatus[] }) | null
> {
  const { rows: pRows } = await pool.query(
    `SELECT p.*,
            COUNT(pm2.user_id) AS member_count,
            pm.role AS my_role
     FROM projects p
     JOIN project_members pm  ON pm.project_id = p.id AND pm.user_id = $2
     JOIN project_members pm2 ON pm2.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, pm.role`,
    [projectId, userId]
  );
  if (!pRows[0]) return null;

  const [members, statuses] = await Promise.all([
    getProjectMembers(projectId),
    getWorkflowStatuses(projectId),
  ]);

  return { ...rowToProject(pRows[0]), members, statuses };
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string | null; boardType?: "kanban" | "scrum" }
): Promise<Project | null> {
  const sets: string[] = ["updated_at = NOW()"];
  const vals: unknown[] = [];
  let i = 1;
  if (data.name !== undefined)        { sets.push(`name = $${i++}`);        vals.push(data.name); }
  if ("description" in data)          { sets.push(`description = $${i++}`); vals.push(data.description ?? null); }
  if (data.boardType !== undefined)   { sets.push(`board_type = $${i++}`);  vals.push(data.boardType); }
  if (vals.length === 0) return null;
  vals.push(projectId);

  const { rows } = await pool.query(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function deleteProject(projectId: string): Promise<void> {
  await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
  await invalidateAllMemberCaches(projectId);
  await invalidateBoardCache(projectId);
}

// ─────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { rows } = await pool.query(
    `SELECT pm.*, u.username, u.email,
            u.display_name, u.avatar_url
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.joined_at`,
    [projectId]
  );
  return rows.map(rowToMember);
}

export async function createInvitation(
  projectId: string,
  invitedBy: string,
  email: string,
  role: string,
  rawToken: string
): Promise<{ id: string; expiresAt: Date }> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL * 1000);

  const { rows } = await pool.query(
    `INSERT INTO project_invitations
       (project_id, invited_by, invited_email, invited_role, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id, invited_email) DO UPDATE
       SET token_hash = EXCLUDED.token_hash,
           invited_role = EXCLUDED.invited_role,
           expires_at = EXCLUDED.expires_at,
           accepted_at = NULL
     RETURNING id, expires_at`,
    [projectId, invitedBy, email, role, tokenHash, expiresAt]
  );

  // Cache invite token
  if (isRedisConnected()) {
    await cacheSet(
      `gmd:pm:invite:${tokenHash}`,
      { projectId, email, role },
      INVITE_TTL
    );
  }

  return { id: rows[0].id, expiresAt };
}

export async function getInvitationByToken(rawToken: string): Promise<{
  id: string; projectId: string; invitedEmail: string; invitedRole: string;
  expiresAt: Date; acceptedAt: Date | null; projectName: string;
} | null> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const { rows } = await pool.query(
    `SELECT pi.*, p.name AS project_name
     FROM project_invitations pi
     JOIN projects p ON p.id = pi.project_id
     WHERE pi.token_hash = $1`,
    [tokenHash]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    projectId: rows[0].project_id,
    invitedEmail: rows[0].invited_email,
    invitedRole: rows[0].invited_role,
    expiresAt: rows[0].expires_at,
    acceptedAt: rows[0].accepted_at ?? null,
    projectName: rows[0].project_name,
  };
}

export async function acceptInvitation(invitationId: string, userId: string, role: string, projectId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE project_invitations SET accepted_at = NOW() WHERE id = $1`,
      [invitationId]
    );
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [projectId, userId, role]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await invalidateMemberCache(projectId, userId);
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await pool.query(
    "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId]
  );
  await invalidateMemberCache(projectId, userId);
}

export async function updateMemberRole(projectId: string, userId: string, role: string): Promise<ProjectMember | null> {
  const { rows } = await pool.query(
    `UPDATE project_members SET role = $3
     WHERE project_id = $1 AND user_id = $2
     RETURNING *`,
    [projectId, userId, role]
  );
  if (rows[0]) await invalidateMemberCache(projectId, userId);
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function transferOwnership(projectId: string, currentOwnerId: string, newOwnerId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",
      [projectId, newOwnerId]
    );
    await client.query(
      "UPDATE project_members SET role='admin' WHERE project_id=$1 AND user_id=$2",
      [projectId, currentOwnerId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await invalidateAllMemberCaches(projectId);
}

// ─────────────────────────────────────────────────────────────────
// Workflow Statuses
// ─────────────────────────────────────────────────────────────────
export async function getWorkflowStatuses(projectId: string): Promise<WorkflowStatus[]> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_statuses WHERE project_id = $1 ORDER BY sort_order`,
    [projectId]
  );
  return rows.map(rowToStatus);
}

export async function getDefaultStatus(projectId: string): Promise<WorkflowStatus | null> {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_statuses
     WHERE project_id = $1 AND is_default = TRUE
     ORDER BY sort_order
     LIMIT 1`,
    [projectId]
  );
  return rows[0] ? rowToStatus(rows[0]) : null;
}

export async function createWorkflowStatus(
  projectId: string,
  data: { name: string; color: string; category: "todo" | "in_progress" | "done" }
): Promise<WorkflowStatus> {
  const { rows: [maxRow] } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) AS max FROM workflow_statuses WHERE project_id = $1",
    [projectId]
  );
  const nextOrder = Number(maxRow.max) + 10;
  const { rows } = await pool.query(
    `INSERT INTO workflow_statuses (project_id, name, color, category, sort_order, is_default)
     VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *`,
    [projectId, data.name, data.color, data.category, nextOrder]
  );
  return rowToStatus(rows[0]);
}

export async function updateWorkflowStatus(
  id: string,
  projectId: string,
  data: { name?: string; color?: string; category?: string; isDefault?: boolean }
): Promise<WorkflowStatus | null> {
  if (data.isDefault) {
    await pool.query(
      "UPDATE workflow_statuses SET is_default = FALSE WHERE project_id = $1",
      [projectId]
    );
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined)     { sets.push(`name = $${idx++}`);       vals.push(data.name); }
  if (data.color !== undefined)    { sets.push(`color = $${idx++}`);      vals.push(data.color); }
  if (data.category !== undefined) { sets.push(`category = $${idx++}`);   vals.push(data.category); }
  if (data.isDefault !== undefined){ sets.push(`is_default = $${idx++}`); vals.push(data.isDefault); }
  if (sets.length === 0) {
    const { rows } = await pool.query(
      "SELECT * FROM workflow_statuses WHERE id = $1 AND project_id = $2", [id, projectId]
    );
    return rows[0] ? rowToStatus(rows[0]) : null;
  }
  vals.push(id, projectId);
  const { rows } = await pool.query(
    `UPDATE workflow_statuses SET ${sets.join(", ")} WHERE id = $${idx++} AND project_id = $${idx++} RETURNING *`,
    vals
  );
  return rows[0] ? rowToStatus(rows[0]) : null;
}

export async function deleteWorkflowStatus(
  id: string,
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  const { rows: [cnt] } = await pool.query(
    "SELECT COUNT(*) FROM workflow_statuses WHERE project_id = $1",
    [projectId]
  );
  if (Number(cnt.count) <= 1) {
    return { ok: false, error: "En az bir workflow durumu olmalı" };
  }
  const { rows: [usage] } = await pool.query(
    "SELECT COUNT(*) FROM issues WHERE status_id = $1 AND project_id = $2 AND archived = FALSE",
    [id, projectId]
  );
  if (Number(usage.count) > 0) {
    return { ok: false, error: "Bu durum aktif görevler tarafından kullanılıyor" };
  }
  await pool.query(
    "DELETE FROM workflow_statuses WHERE id = $1 AND project_id = $2",
    [id, projectId]
  );
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────────────────────────
const ISSUE_SELECT = `
  i.*,
  ws.name  AS status_name,
  ws.color AS status_color,
  ws.category AS status_category,
  ua.username AS assignee_username,
  ua.display_name AS assignee_display_name,
  ua.avatar_url AS assignee_avatar_url,
  ur.username AS reporter_username,
  pi.issue_key AS parent_issue_key,
  pi.title AS parent_title
FROM issues i
JOIN workflow_statuses ws ON ws.id = i.status_id
LEFT JOIN users ua ON ua.id = i.assignee_id
JOIN users ur ON ur.id = i.reporter_id
LEFT JOIN issues pi ON pi.id = i.parent_id`;

export async function createIssue(data: {
  projectId: string;
  projectKey: string;
  reporterId: string;
  title: string;
  description?: string;
  issueType: string;
  priority: string;
  labels?: string[];
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  sprintId?: string | null;
  statusId: string;
}): Promise<Issue> {
  const issueNumber = await pool.query(
    "SELECT next_issue_number($1) AS num",
    [data.projectId]
  );
  const num = issueNumber.rows[0].num;
  const issueKey = `${data.projectKey}-${num}`;

  const { rows } = await pool.query(
    `INSERT INTO issues
       (project_id, issue_number, issue_key, title, description, issue_type, status_id,
        priority, labels, assignee_id, reporter_id, due_date, estimated_hours, sprint_id, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             COALESCE((SELECT MAX(sort_order)+1 FROM issues WHERE project_id=$1 AND status_id=$7 AND archived=FALSE), 0))
     RETURNING *`,
    [
      data.projectId, num, issueKey, data.title, data.description ?? null,
      data.issueType, data.statusId, data.priority, data.labels ?? [],
      data.assigneeId ?? null, data.reporterId, data.dueDate ?? null,
      data.estimatedHours ?? null, data.sprintId ?? null,
    ]
  );

  // Fetch with joins
  const { rows: full } = await pool.query(
    `SELECT ${ISSUE_SELECT} WHERE i.id = $1`,
    [rows[0].id]
  );
  return rowToIssue(full[0]);
}

export async function getIssues(
  projectId: string,
  filters: {
    status?: string; assignee?: string; type?: string; priority?: string;
    label?: string; sprint?: string; q?: string; archived?: boolean;
    page?: number; limit?: number;
  } = {}
): Promise<{ issues: Issue[]; total: number }> {
  const conditions: string[] = ["i.project_id = $1"];
  const vals: unknown[] = [projectId];
  let idx = 2;

  conditions.push(`i.archived = $${idx++}`);
  vals.push(filters.archived ?? false);

  if (filters.status)   { conditions.push(`i.status_id = $${idx++}`);  vals.push(filters.status); }
  if (filters.assignee) { conditions.push(`i.assignee_id = $${idx++}`); vals.push(filters.assignee); }
  if (filters.type)     { conditions.push(`i.issue_type = $${idx++}`);  vals.push(filters.type); }
  if (filters.priority) { conditions.push(`i.priority = $${idx++}`);   vals.push(filters.priority); }
  if (filters.label)    { conditions.push(`$${idx++} = ANY(i.labels)`); vals.push(filters.label); }
  if (filters.sprint !== undefined) {
    if (filters.sprint === "backlog") {
      conditions.push("i.sprint_id IS NULL");
    } else {
      conditions.push(`i.sprint_id = $${idx++}`);
      vals.push(filters.sprint);
    }
  }
  if (filters.q) {
    conditions.push(`i.title ILIKE $${idx++}`);
    vals.push(`%${filters.q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM issues i ${where}`, vals
  );
  const total = Number(countRows[0].count);

  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = ((filters.page ?? 1) - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ${ISSUE_SELECT} ${where}
     ORDER BY i.sort_order, i.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...vals, limit, offset]
  );
  return { issues: rows.map(rowToIssue), total };
}

export async function getIssueById(issueId: string): Promise<Issue | null> {
  const { rows } = await pool.query(
    `SELECT ${ISSUE_SELECT} WHERE i.id = $1`,
    [issueId]
  );
  return rows[0] ? rowToIssue(rows[0]) : null;
}

export async function getIssueByKey(issueKey: string): Promise<Issue | null> {
  const { rows } = await pool.query(
    `SELECT ${ISSUE_SELECT} WHERE i.issue_key = $1`,
    [issueKey]
  );
  return rows[0] ? rowToIssue(rows[0]) : null;
}

export async function updateIssue(
  issueId: string,
  data: Record<string, unknown>,
  changedBy: string
): Promise<Issue | null> {
  // Fetch current for history
  const current = await getIssueById(issueId);
  if (!current) return null;

  const fieldMap: Record<string, string> = {
    title: "title", description: "description", issueType: "issue_type",
    statusId: "status_id", priority: "priority", labels: "labels",
    assigneeId: "assignee_id", dueDate: "due_date",
    estimatedHours: "estimated_hours", loggedHours: "logged_hours",
    storyPoints: "story_points",
    sprintId: "sprint_id", sortOrder: "sort_order",
    parentId: "parent_id",
  };

  const sets: string[] = ["updated_at = NOW()"];
  const vals: unknown[] = [];
  let i = 1;

  const historyEntries: Array<{ field: string; old: string | null; nw: string | null }> = [];

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in data) {
      sets.push(`${col} = $${i++}`);
      vals.push(data[key] ?? null);

      const oldVal = (current as any)[key];
      const newVal = data[key];
      if (String(oldVal) !== String(newVal)) {
        historyEntries.push({
          field: key,
          old: oldVal != null ? String(oldVal) : null,
          nw: newVal != null ? String(newVal) : null,
        });
      }
    }
  }

  // Handle resolved_at when category changes to done
  if ("statusId" in data && data.statusId !== current.statusId) {
    const { rows: wsRows } = await pool.query(
      "SELECT category FROM workflow_statuses WHERE id = $1", [data.statusId]
    );
    if (wsRows[0]?.category === "done") {
      sets.push(`resolved_at = NOW()`);
    } else if (current.resolvedAt) {
      sets.push(`resolved_at = NULL`);
    }
  }

  if (vals.length === 0) return current;
  vals.push(issueId);

  const { rows } = await pool.query(
    `UPDATE issues SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;

  // Log history
  for (const entry of historyEntries) {
    await logIssueHistory(issueId, changedBy, entry.field, entry.old, entry.nw);
  }

  const { rows: full } = await pool.query(
    `SELECT ${ISSUE_SELECT} WHERE i.id = $1`, [issueId]
  );
  return full[0] ? rowToIssue(full[0]) : null;
}

export async function archiveIssue(issueId: string, archived: boolean): Promise<void> {
  await pool.query(
    `UPDATE issues SET archived = $2, updated_at = NOW()
     WHERE id = $1 OR parent_id = $1`,
    [issueId, archived]
  );
}

export async function deleteIssuePermanent(issueId: string): Promise<void> {
  await pool.query("DELETE FROM issues WHERE id = $1 OR parent_id = $1", [issueId]);
}

// ─────────────────────────────────────────────────────────────────
// Board data (Redis cached)
// ─────────────────────────────────────────────────────────────────
export async function getBoardData(projectId: string, sprintId?: string | null): Promise<BoardData | null> {
  const cacheKey = `gmd:pm:board:${projectId}:${sprintId ?? "kanban"}`;
  const cached = await cacheGet<BoardData>(cacheKey);
  if (cached) return cached;

  const [statuses, members, projectRows] = await Promise.all([
    getWorkflowStatuses(projectId),
    getProjectMembers(projectId),
    pool.query(`SELECT p.*, pm.role AS my_role FROM projects p
                LEFT JOIN project_members pm ON pm.project_id = p.id
                WHERE p.id = $1 LIMIT 1`, [projectId]),
  ]);

  if (!projectRows.rows[0]) return null;
  const project = rowToProject(projectRows.rows[0]);

  // Fetch issues grouped by status
  const conditions: string[] = ["i.project_id = $1", "i.archived = FALSE"];
  const vals: unknown[] = [projectId];
  if (sprintId === "backlog") {
    conditions.push("i.sprint_id IS NULL");
  } else if (sprintId) {
    conditions.push("i.sprint_id = $2");
    vals.push(sprintId);
  }

  const { rows: issueRows } = await pool.query(
    `SELECT ${ISSUE_SELECT}
     WHERE ${conditions.join(" AND ")}
     ORDER BY i.sort_order, i.created_at`,
    vals
  );

  const columns: Record<string, BoardColumn> = {};
  for (const s of statuses) {
    columns[s.id] = { status: s, issues: [] };
  }
  for (const row of issueRows) {
    const issue = rowToIssue(row);
    if (columns[issue.statusId]) {
      columns[issue.statusId].issues.push(issue);
    }
  }

  const data: BoardData = { statuses, columns, members, project };
  await cacheSet(cacheKey, data, BOARD_TTL);
  return data;
}

export async function invalidateBoardCache(projectId: string): Promise<void> {
  await cacheDelPattern(`gmd:pm:board:${projectId}:*`);
}

// ─────────────────────────────────────────────────────────────────
// Issue detail (Redis cached)
// ─────────────────────────────────────────────────────────────────
export async function getIssueDetail(issueId: string): Promise<IssueDetail | null> {
  const cacheKey = `gmd:pm:issue:${issueId}`;
  const cached = await cacheGet<IssueDetail>(cacheKey);
  if (cached) return cached;

  const issue = await getIssueById(issueId);
  if (!issue) return null;

  const [comments, history, links, childRows] = await Promise.all([
    getIssueComments(issueId),
    getIssueHistory(issueId),
    getIssueLinks(issueId),
    pool.query(`SELECT ${ISSUE_SELECT} WHERE i.parent_id = $1 AND i.archived = FALSE ORDER BY i.sort_order, i.created_at`, [issueId]),
  ]);

  const children = childRows.rows.map(rowToIssue);
  const detail: IssueDetail = { ...issue, comments, history, links, children };
  await cacheSet(cacheKey, detail, ISSUE_TTL);
  return detail;
}

export async function invalidateIssueCache(issueId: string): Promise<void> {
  await cacheDel(`gmd:pm:issue:${issueId}`);
}

// ─────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────
export async function getIssueComments(issueId: string): Promise<IssueComment[]> {
  const { rows } = await pool.query(
    `SELECT c.*, u.username AS author_username,
            u.display_name AS author_display_name, u.avatar_url AS author_avatar_url
     FROM issue_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.issue_id = $1
     ORDER BY c.created_at`,
    [issueId]
  );
  return rows.map(rowToComment);
}

export async function addComment(
  issueId: string,
  authorId: string,
  content: string,
  mentions: string[]
): Promise<IssueComment> {
  const { rows } = await pool.query(
    `INSERT INTO issue_comments (issue_id, author_id, content, mentions)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [issueId, authorId, content, mentions]
  );
  const { rows: full } = await pool.query(
    `SELECT c.*, u.username AS author_username,
            u.display_name AS author_display_name, u.avatar_url AS author_avatar_url
     FROM issue_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.id = $1`,
    [rows[0].id]
  );
  await invalidateIssueCache(issueId);
  return rowToComment(full[0]);
}

export async function updateComment(
  commentId: string,
  authorId: string,
  content: string
): Promise<IssueComment | null> {
  const { rows } = await pool.query(
    `UPDATE issue_comments SET content = $3, edited_at = NOW()
     WHERE id = $1 AND author_id = $2 RETURNING *`,
    [commentId, authorId, content]
  );
  if (rows[0]) await invalidateIssueCache(rows[0].issue_id);
  return rows[0] ? rowToComment(rows[0]) : null;
}

export async function deleteComment(commentId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "DELETE FROM issue_comments WHERE id = $1 RETURNING issue_id",
    [commentId]
  );
  if (rows[0]) await invalidateIssueCache(rows[0].issue_id);
  return rows[0]?.issue_id ?? null;
}

export async function getComment(commentId: string): Promise<IssueComment | null> {
  const { rows } = await pool.query(
    "SELECT * FROM issue_comments WHERE id = $1", [commentId]
  );
  return rows[0] ? rowToComment(rows[0]) : null;
}

// ─────────────────────────────────────────────────────────────────
// Issue History
// ─────────────────────────────────────────────────────────────────
export async function logIssueHistory(
  issueId: string,
  changedBy: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)`,
    [issueId, changedBy, fieldName, oldValue, newValue]
  );
}

export async function getIssueHistory(issueId: string): Promise<IssueHistory[]> {
  const { rows } = await pool.query(
    `SELECT h.*, u.username AS changed_by_username
     FROM issue_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.issue_id = $1
     ORDER BY h.changed_at DESC
     LIMIT 100`,
    [issueId]
  );
  return rows.map(rowToHistory);
}

// ─────────────────────────────────────────────────────────────────
// "Planıma Ekle" bridge
// ─────────────────────────────────────────────────────────────────
export async function addIssueToPlan(
  issueId: string,
  userId: string,
  date: string,
  scheduledTime?: string
): Promise<{ planItemId: string }> {
  const issue = await getIssueById(issueId);
  if (!issue) throw new Error("Issue not found");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: piRows } = await client.query(
      `INSERT INTO plan_items
         (id, user_id, date, description, category, scheduled_time, sort_order, item_type)
       VALUES ($1, $2, $3, $4, 'dev', $5,
               COALESCE((SELECT MAX(sort_order)+1 FROM plan_items WHERE user_id=$2 AND date=$3), 0),
               'plan')
       RETURNING id`,
      [nanoid(8), userId, date, `[${issue.issueKey}] ${issue.title}`, scheduledTime ?? null]
    );
    const planItemId = piRows[0].id;

    await client.query(
      "UPDATE issues SET plan_item_id = $2, updated_at = NOW() WHERE id = $1",
      [issueId, planItemId]
    );

    await client.query("COMMIT");
    return { planItemId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function removeIssueFromPlan(issueId: string): Promise<void> {
  const { rows } = await pool.query(
    "SELECT plan_item_id, project_id FROM issues WHERE id = $1",
    [issueId]
  );
  if (!rows[0]?.plan_item_id) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE issues SET plan_item_id = NULL, updated_at = NOW() WHERE id = $1", [issueId]);
    await client.query("DELETE FROM plan_items WHERE id = $1", [rows[0].plan_item_id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function syncPlanItemCompletion(planItemId: string, completed: boolean): Promise<void> {
  const { rows: issueRows } = await pool.query(
    "SELECT id, project_id, status_id FROM issues WHERE plan_item_id = $1",
    [planItemId]
  );
  if (!issueRows[0]) return;

  const { id: issueId, project_id: projectId } = issueRows[0];
  const category = completed ? "done" : "todo";

  const { rows: statusRows } = await pool.query(
    `SELECT id, name FROM workflow_statuses
     WHERE project_id = $1 AND category = $2
     ORDER BY sort_order LIMIT 1`,
    [projectId, category]
  );
  if (!statusRows[0]) return;

  const oldStatusId = issueRows[0].status_id;
  if (oldStatusId === statusRows[0].id) return;

  await pool.query(
    `UPDATE issues SET status_id = $2, updated_at = NOW()
     ${completed ? ", resolved_at = NOW()" : ", resolved_at = NULL"}
     WHERE id = $1`,
    [issueId, statusRows[0].id]
  );

  await Promise.all([
    invalidateIssueCache(issueId),
    invalidateBoardCache(projectId),
  ]);
}

export async function getMyAssignments(
  userId: string,
  date?: string
): Promise<Array<{ issueId: string; projectId: string; planItemId: string | null; issueKey: string; title: string }>> {
  const { rows } = await pool.query(
    `SELECT i.id AS issue_id, i.project_id, i.plan_item_id, i.issue_key, i.title
     FROM issues i
     WHERE i.assignee_id = $1
       AND i.archived = FALSE
       ${date ? "AND (i.due_date IS NULL OR i.due_date = $2)" : ""}
     ORDER BY i.updated_at DESC
     LIMIT 50`,
    date ? [userId, date] : [userId]
  );
  return rows.map((r: any) => ({
    issueId: r.issue_id,
    projectId: r.project_id,
    planItemId: r.plan_item_id ?? null,
    issueKey: r.issue_key,
    title: r.title,
  }));
}

// ─────────────────────────────────────────────────────────────────
// Notification queue
// ─────────────────────────────────────────────────────────────────
export type ProjectNotificationEvent =
  | { type: "issue_assigned"; issueId: string; assigneeId: string; assignerName: string; projectName: string; issueKey: string; issueTitle: string }
  | { type: "comment_mention"; issueId: string; mentionedId: string; authorName: string; projectName: string; issueKey: string; commentPreview: string }
  | { type: "issue_done"; issueId: string; assigneeId: string; toStatus: string; changerName: string; issueKey: string; issueTitle: string };

export async function enqueueProjectNotification(event: ProjectNotificationEvent): Promise<void> {
  if (!isRedisConnected()) return;
  try { await redis.lpush("gmd:pm:notify", JSON.stringify(event)); }
  catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────
// Member count check
// ─────────────────────────────────────────────────────────────────
export async function getMemberCount(projectId: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM project_members WHERE project_id = $1",
    [projectId]
  );
  return Number(rows[0].count);
}

export async function getUserProjectCount(userId: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM project_members WHERE user_id = $1 AND role = 'owner'",
    [userId]
  );
  return Number(rows[0].count);
}

// ─────────────────────────────────────────────────────────────────
// Issue Links
// ─────────────────────────────────────────────────────────────────
function rowToLink(r: any): IssueLink {
  return {
    id: r.id,
    projectId: r.project_id,
    sourceId: r.source_id,
    targetId: r.target_id,
    linkType: r.link_type,
    createdAt: r.created_at,
    targetIssueKey: r.target_issue_key,
    targetTitle: r.target_title,
    targetStatusName: r.target_status_name,
    targetStatusColor: r.target_status_color,
    targetPriority: r.target_priority,
  };
}

export async function getIssueLinks(issueId: string): Promise<IssueLink[]> {
  const { rows } = await pool.query(
    `SELECT il.*,
            i.issue_key AS target_issue_key,
            i.title AS target_title,
            i.priority AS target_priority,
            ws.name AS target_status_name,
            ws.color AS target_status_color
     FROM issue_links il
     JOIN issues i ON i.id = il.target_id
     JOIN workflow_statuses ws ON ws.id = i.status_id
     WHERE il.source_id = $1
     ORDER BY il.created_at`,
    [issueId]
  );
  return rows.map(rowToLink);
}

export async function createIssueLink(
  projectId: string,
  sourceId: string,
  targetId: string,
  linkType: string,
  createdBy: string
): Promise<{ ok: boolean; error?: string; link?: IssueLink; reverseLink?: IssueLink }> {
  if (sourceId === targetId) return { ok: false, error: "Bir görev kendine bağlanamaz" };

  // Upsert — ignore duplicate
  const { rows } = await pool.query(
    `INSERT INTO issue_links (project_id, source_id, target_id, link_type, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_id, target_id, link_type) DO NOTHING
     RETURNING *`,
    [projectId, sourceId, targetId, linkType, createdBy]
  );
  if (!rows[0]) return { ok: false, error: "Bu bağlantı zaten var" };

  // Create reverse link for symmetric types
  const REVERSE: Record<string, string> = {
    blocks:           "is_blocked_by",
    is_blocked_by:    "blocks",
    duplicates:       "is_duplicated_by",
    is_duplicated_by: "duplicates",
  };
  const reverseType = REVERSE[linkType];
  if (reverseType) {
    await pool.query(
      `INSERT INTO issue_links (project_id, source_id, target_id, link_type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_id, target_id, link_type) DO NOTHING`,
      [projectId, targetId, sourceId, reverseType, createdBy]
    );
  }

  const links = await getIssueLinks(sourceId);
  return { ok: true, link: links.find(l => l.id === rows[0].id) };
}

export async function deleteIssueLink(id: string, projectId: string, issueId: string): Promise<void> {
  // Get the link first to find the reverse
  const { rows } = await pool.query(
    "SELECT * FROM issue_links WHERE id = $1 AND project_id = $2",
    [id, projectId]
  );
  if (!rows[0]) return;
  const { source_id, target_id, link_type } = rows[0];

  const REVERSE: Record<string, string> = {
    blocks:           "is_blocked_by",
    is_blocked_by:    "blocks",
    duplicates:       "is_duplicated_by",
    is_duplicated_by: "duplicates",
  };
  const reverseType = REVERSE[link_type];

  await pool.query("DELETE FROM issue_links WHERE id = $1", [id]);
  if (reverseType) {
    await pool.query(
      "DELETE FROM issue_links WHERE source_id = $1 AND target_id = $2 AND link_type = $3",
      [target_id, source_id, reverseType]
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────
export async function searchIssues(
  userId: string,
  query: string,
  limit = 20
): Promise<Array<{
  id: string; issueKey: string; title: string;
  projectId: string; projectName: string;
  priority: string; issueType: string;
  statusName: string; statusColor: string;
}>> {
  const pattern = `%${query.toLowerCase()}%`;
  const { rows } = await pool.query(
    `SELECT i.id, i.issue_key AS "issueKey", i.title,
            i.project_id AS "projectId", p.name AS "projectName",
            i.priority, i.issue_type AS "issueType",
            ws.name AS "statusName", ws.color AS "statusColor"
     FROM issues i
     JOIN projects p ON p.id = i.project_id
     JOIN workflow_statuses ws ON ws.id = i.status_id
     JOIN project_members pm ON pm.project_id = i.project_id AND pm.user_id = $1
     WHERE i.archived = FALSE
       AND (LOWER(i.title) ILIKE $3 OR similarity(LOWER(i.title), $2) > 0.15)
     ORDER BY similarity(LOWER(i.title), $2) DESC
     LIMIT $4`,
    [userId, query.toLowerCase(), pattern, limit]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────
// Issue reorder
// ─────────────────────────────────────────────────────────────────

export async function reorderIssues(orders: Array<{ issueId: string; sortOrder: number }>): Promise<void> {
  if (orders.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { issueId, sortOrder } of orders) {
      await client.query("UPDATE issues SET sort_order = $2 WHERE id = $1", [issueId, sortOrder]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────
// Sprints
// ─────────────────────────────────────────────────────────────────

function mapSprint(r: any) {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    goal: r.goal ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
    completedAt: r.completed_at ?? null,
    issueCount: r.issue_count !== undefined ? Number(r.issue_count) : undefined,
  };
}

export async function getProjectSprints(projectId: string) {
  const { rows } = await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*) FROM issues WHERE sprint_id = s.id AND archived = FALSE) AS issue_count
     FROM sprints s
     WHERE s.project_id = $1
     ORDER BY s.created_at`,
    [projectId]
  );
  return rows.map(mapSprint);
}

export async function getSprint(sprintId: string) {
  const { rows } = await pool.query("SELECT * FROM sprints WHERE id = $1", [sprintId]);
  return rows[0] ? mapSprint(rows[0]) : null;
}

export async function createSprint(projectId: string, data: { name: string; goal?: string; startDate?: string; endDate?: string }) {
  const { rows } = await pool.query(
    `INSERT INTO sprints (project_id, name, goal, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [projectId, data.name, data.goal ?? null, data.startDate ?? null, data.endDate ?? null]
  );
  return mapSprint(rows[0]);
}

export async function updateSprint(sprintId: string, data: { name?: string; goal?: string | null; startDate?: string | null; endDate?: string | null; status?: string }) {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.name !== undefined)      { sets.push(`name = $${i++}`);       vals.push(data.name); }
  if (data.goal !== undefined)      { sets.push(`goal = $${i++}`);       vals.push(data.goal); }
  if (data.startDate !== undefined) { sets.push(`start_date = $${i++}`); vals.push(data.startDate); }
  if (data.endDate !== undefined)   { sets.push(`end_date = $${i++}`);   vals.push(data.endDate); }
  if (data.status !== undefined) {
    sets.push(`status = $${i++}`);
    vals.push(data.status);
    if (data.status === "completed") sets.push(`completed_at = NOW()`);
  }
  if (sets.length === 0) return getSprint(sprintId);
  vals.push(sprintId);
  const { rows } = await pool.query(
    `UPDATE sprints SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? mapSprint(rows[0]) : null;
}

export async function deleteSprint(sprintId: string) {
  // Issues go to backlog via FK ON DELETE SET NULL
  await pool.query("DELETE FROM sprints WHERE id = $1", [sprintId]);
}

export async function setIssueSprint(issueId: string, sprintId: string | null) {
  await pool.query(
    "UPDATE issues SET sprint_id = $2, updated_at = NOW() WHERE id = $1",
    [issueId, sprintId]
  );
}

// Complete a sprint: mark as completed, move non-done issues to backlog or next sprint
export async function completeSprint(
  sprintId: string,
  incompleteAction: "backlog" | "next_sprint",
  nextSprintId?: string | null
): Promise<{ completedCount: number; movedCount: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get sprint's project to find done workflow statuses
    const { rows: sprintRows } = await client.query(
      "SELECT project_id FROM sprints WHERE id = $1", [sprintId]
    );
    if (!sprintRows[0]) throw new Error("Sprint bulunamadı");
    const projectId = sprintRows[0].project_id;

    // Find all "done" status IDs for this project
    const { rows: doneStatuses } = await client.query(
      "SELECT id FROM workflow_statuses WHERE project_id = $1 AND category = 'done'",
      [projectId]
    );
    const doneIds = doneStatuses.map((r: any) => r.id);

    // Count completed issues
    const { rows: completedRows } = await client.query(
      `SELECT COUNT(*) FROM issues WHERE sprint_id = $1 AND status_id = ANY($2) AND archived = FALSE`,
      [sprintId, doneIds]
    );
    const completedCount = Number(completedRows[0].count);

    // Move non-done issues
    const targetSprintId = incompleteAction === "next_sprint" && nextSprintId ? nextSprintId : null;
    const { rowCount: movedCount } = await client.query(
      `UPDATE issues SET sprint_id = $2, updated_at = NOW()
       WHERE sprint_id = $1 AND NOT (status_id = ANY($3)) AND archived = FALSE`,
      [sprintId, targetSprintId, doneIds]
    );

    // Mark sprint as completed
    await client.query(
      "UPDATE sprints SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [sprintId]
    );

    await client.query("COMMIT");
    return { completedCount, movedCount: movedCount ?? 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getProjectLabels(projectId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT UNNEST(labels) AS label
     FROM issues
     WHERE project_id = $1 AND array_length(labels, 1) > 0
     ORDER BY label`,
    [projectId]
  );
  return rows.map((r: any) => r.label as string);
}
