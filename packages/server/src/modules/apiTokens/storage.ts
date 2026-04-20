import crypto from "node:crypto";
import { pool } from "../../db.js";

export interface ApiTokenRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const TOKEN_PREFIX = "gmd_pat_";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRawApiToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString("hex");
}

export async function listApiTokens(userId: string): Promise<ApiTokenRow[]> {
  const { rows } = await pool.query(
    `SELECT id, name, created_at AS "createdAt", last_used_at AS "lastUsedAt"
     FROM user_api_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    lastUsedAt: r.lastUsedAt
      ? (r.lastUsedAt instanceof Date ? r.lastUsedAt.toISOString() : String(r.lastUsedAt))
      : null,
  }));
}

export async function createApiToken(userId: string, name: string): Promise<{ id: string; raw: string }> {
  const raw = generateRawApiToken();
  const hash = hashToken(raw);
  const { rows } = await pool.query(
    `INSERT INTO user_api_tokens (user_id, name, token_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, name, hash],
  );
  return { id: rows[0].id, raw };
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE user_api_tokens
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  return (rowCount ?? 0) > 0;
}

// Reject obvious non-tokens early (before DB hit)
export function isApiTokenShape(raw: string): boolean {
  return raw.startsWith(TOKEN_PREFIX) && raw.length === TOKEN_PREFIX.length + 48;
}

export async function resolveApiToken(raw: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!isApiTokenShape(raw)) return null;
  const hash = hashToken(raw);
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId"
     FROM user_api_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [hash],
  );
  if (rows.length === 0) return null;
  return { userId: rows[0].userId, tokenId: rows[0].id };
}

export async function touchApiToken(tokenId: string): Promise<void> {
  await pool.query(
    `UPDATE user_api_tokens SET last_used_at = NOW() WHERE id = $1`,
    [tokenId],
  ).catch(() => {});
}
