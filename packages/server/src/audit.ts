import type { Request } from "express";
import { pool } from "./db.js";

export type AuditEvent =
  | "login_success"
  | "login_failed"
  | "register"
  | "logout"
  | "password_change"
  | "session_refresh"
  | "user_approved";

export function getClientIp(req: Request): string {
  // Trust X-Forwarded-For from reverse proxy (nginx ingress)
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export async function logAuditEvent(
  event: AuditEvent,
  req: Request,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, event, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        event,
        getClientIp(req),
        req.headers["user-agent"] || null,
        metadata ? JSON.stringify(metadata) : "{}",
      ]
    );
  } catch {
    // Don't let audit failures break the app
  }
}
