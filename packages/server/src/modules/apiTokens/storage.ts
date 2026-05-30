import crypto from "node:crypto";
import { pool } from "../../db.js";

export type ApiKeyRequestStatus = "pending" | "approved" | "rejected";

export interface ApiKeyRequest {
  id: string;
  userId: string;
  reason: string | null;
  status: ApiKeyRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
}

export async function getApiKeyRequest(userId: string): Promise<ApiKeyRequest | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId", reason, status,
            requested_at AS "requestedAt", reviewed_at AS "reviewedAt"
     FROM api_key_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC LIMIT 1`,
    [userId],
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    requestedAt: rows[0].requestedAt instanceof Date ? rows[0].requestedAt.toISOString() : String(rows[0].requestedAt),
    reviewedAt: rows[0].reviewedAt ? (rows[0].reviewedAt instanceof Date ? rows[0].reviewedAt.toISOString() : String(rows[0].reviewedAt)) : null,
  };
}

export async function createApiKeyRequest(userId: string, reason?: string): Promise<{ id: string; reviewToken: string }> {
  const reviewToken = crypto.randomBytes(32).toString("hex");
  const { rows } = await pool.query(
    `INSERT INTO api_key_requests (user_id, reason, review_token)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, reason ?? null, reviewToken],
  );
  return { id: rows[0].id, reviewToken };
}

export async function approveApiKeyRequest(requestId: string, reviewToken: string): Promise<{ userId: string; username: string; email: string } | null> {
  const { rows } = await pool.query(
    `UPDATE api_key_requests SET status = 'approved', reviewed_at = NOW(), review_token = NULL
     WHERE id = $1 AND review_token = $2 AND status = 'pending'
     RETURNING user_id AS "userId"`,
    [requestId, reviewToken],
  );
  if (!rows[0]) return null;
  const { rows: userRows } = await pool.query(
    `SELECT username, email FROM users WHERE id = $1`,
    [rows[0].userId],
  );
  if (!userRows[0]) return null;
  return { userId: rows[0].userId, username: userRows[0].username, email: userRows[0].email };
}

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
    `SELECT t.id, t.user_id AS "userId"
     FROM user_api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.deleted_at IS NULL
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
