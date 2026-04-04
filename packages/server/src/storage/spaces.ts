// storage/spaces.ts — Space CRUD queries
// UI integration is deferred. These functions are ready for future frontend wiring.

import { pool } from "../db.js";
import type { Space, SpaceMember } from "@gmd/shared";

function rowToSpace(r: any): Space {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    icon: r.icon ?? null,
    color: r.color,
    ownerId: r.owner_id,
    settings: r.settings ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    myRole: r.my_role ?? undefined,
    memberCount: r.member_count !== undefined ? Number(r.member_count) : undefined,
    projectCount: r.project_count !== undefined ? Number(r.project_count) : undefined,
  };
}

function rowToMember(r: any): SpaceMember {
  return {
    spaceId: r.space_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    username: r.username,
    displayName: r.display_name ?? null,
    avatarUrl: r.avatar_url ?? null,
    email: r.email,
  };
}

export async function getUserSpaces(userId: string): Promise<Space[]> {
  const { rows } = await pool.query(
    `SELECT s.*,
            sm.role AS my_role,
            (SELECT COUNT(*) FROM space_members WHERE space_id = s.id) AS member_count,
            (SELECT COUNT(*) FROM projects WHERE space_id = s.id) AS project_count
     FROM spaces s
     JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows.map(rowToSpace);
}

export async function getSpace(id: string): Promise<Space | null> {
  const { rows } = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM space_members WHERE space_id = s.id) AS member_count,
            (SELECT COUNT(*) FROM projects WHERE space_id = s.id) AS project_count
     FROM spaces s
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] ? rowToSpace(rows[0]) : null;
}

export async function createSpace(
  name: string,
  slug: string,
  ownerId: string,
  description?: string,
  icon?: string,
  color?: string
): Promise<Space> {
  const { rows } = await pool.query(
    `INSERT INTO spaces (name, slug, owner_id, description, icon, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, slug, ownerId, description ?? null, icon ?? null, color ?? "#6b7280"]
  );
  await pool.query(
    `INSERT INTO space_members (space_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [rows[0].id, ownerId]
  );
  return rowToSpace({ ...rows[0], my_role: "owner", member_count: 1, project_count: 0 });
}

export async function updateSpace(
  id: string,
  data: { name?: string; slug?: string; description?: string | null; icon?: string | null; color?: string }
): Promise<Space | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.name !== undefined)        { fields.push(`name = $${i++}`);        values.push(data.name); }
  if (data.slug !== undefined)        { fields.push(`slug = $${i++}`);        values.push(data.slug); }
  if (data.description !== undefined) { fields.push(`description = $${i++}`); values.push(data.description); }
  if (data.icon !== undefined)        { fields.push(`icon = $${i++}`);        values.push(data.icon); }
  if (data.color !== undefined)       { fields.push(`color = $${i++}`);       values.push(data.color); }
  if (!fields.length) return getSpace(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE spaces SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] ? rowToSpace(rows[0]) : null;
}

export async function deleteSpace(id: string): Promise<void> {
  // Projects keep their data — space_id is set to NULL (ON DELETE SET NULL)
  await pool.query("DELETE FROM spaces WHERE id = $1", [id]);
}

export async function getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { rows } = await pool.query(
    `SELECT sm.*, u.username, u.email, u.display_name, u.avatar_url
     FROM space_members sm
     JOIN users u ON u.id = sm.user_id
     WHERE sm.space_id = $1
     ORDER BY sm.joined_at`,
    [spaceId]
  );
  return rows.map(rowToMember);
}

export async function getSpaceMemberRole(spaceId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT role FROM space_members WHERE space_id = $1 AND user_id = $2",
    [spaceId, userId]
  );
  return rows[0]?.role ?? null;
}

export async function addSpaceMember(spaceId: string, userId: string, role = "member"): Promise<void> {
  await pool.query(
    `INSERT INTO space_members (space_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (space_id, user_id) DO UPDATE SET role = $3`,
    [spaceId, userId, role]
  );
}

export async function removeSpaceMember(spaceId: string, userId: string): Promise<void> {
  await pool.query(
    "DELETE FROM space_members WHERE space_id = $1 AND user_id = $2",
    [spaceId, userId]
  );
}

export async function assignProjectToSpace(projectId: string, spaceId: string | null): Promise<void> {
  await pool.query("UPDATE projects SET space_id = $1 WHERE id = $2", [spaceId, projectId]);
}
