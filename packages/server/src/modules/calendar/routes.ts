import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { pool } from "../../db.js";
import {
  listCalendarTokens,
  createCalendarToken,
  revokeCalendarToken,
  resolveCalendarToken,
  touchCalendarToken,
  getCalendarEvents,
} from "./storage.js";
import { buildIcs } from "./ical.js";

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Public router — no auth, token in query ──────────────────────
export const publicRouter = Router();

publicRouter.get("/calendar.ics", wrap(async (req, res) => {
  const raw = typeof req.query.token === "string" ? req.query.token : "";
  if (!raw) {
    res.status(401).type("text/plain").send("Missing token");
    return;
  }

  const resolved = await resolveCalendarToken(raw);
  if (!resolved) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }

  // Look up username for calendar label
  const { rows: userRows } = await pool.query(
    `SELECT username FROM users WHERE id = $1`,
    [resolved.userId],
  );
  if (userRows.length === 0) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  const username = userRows[0].username as string;

  const appOrigin = process.env.CORS_ORIGIN?.split(",")[0]?.trim() || "https://gmd.byfeb.com";
  const { events, lastModified } = await getCalendarEvents(resolved.userId, username, appOrigin);

  const etag = `"${crypto.createHash("sha1")
    .update(`${resolved.userId}:${lastModified.toISOString()}:${events.length}`)
    .digest("hex")}"`;

  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  const body = buildIcs(`GitMyDayTime — ${username}`, events);

  // Fire-and-forget: update last_used_at
  touchCalendarToken(resolved.tokenId);

  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Cache-Control", "private, max-age=600"); // override no-store from /api middleware
  res.set("ETag", etag);
  res.set("Last-Modified", lastModified.toUTCString());
  res.set("Content-Disposition", 'inline; filename="gitmydaytime.ics"');
  res.send(body);
}));

// ── Authed router — token management ─────────────────────────────
export const authedRouter = Router();

authedRouter.get("/tokens", wrap(async (req, res) => {
  const tokens = await listCalendarTokens(req.userId!);
  res.json({ tokens });
}));

authedRouter.post("/tokens", wrap(async (req, res) => {
  const { id, raw } = await createCalendarToken(req.userId!);
  const appOrigin = process.env.CORS_ORIGIN?.split(",")[0]?.trim() || "https://gmd.byfeb.com";
  const url = `${appOrigin}/api/calendar.ics?token=${raw}`;
  // Return raw + url ONCE — client must save it; later lookups never expose raw
  res.status(201).json({ id, token: raw, url });
}));

authedRouter.delete("/tokens/:id", wrap(async (req, res) => {
  const ok = await revokeCalendarToken(req.userId!, req.params.id as string);
  if (!ok) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  res.status(204).end();
}));
