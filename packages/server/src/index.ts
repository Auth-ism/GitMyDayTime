import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { authMiddleware, authRouter, getAuthLimiter, createRateLimiter, IS_PROD } from "./auth.js";
import { pool, runMigrations } from "./db.js";
import { connectRedis, redis, isRedisConnected, rebuildReminderIndex } from "./redis.js";
import {
  tasksRouter as taskRoutes,
  planRouter as planRoutes,
  statsRouter as statsRoutes,
  searchRouter as searchRoutes,
  recurringRouter as recurringRoutes,
  categoriesRouter as categoryRoutes,
  journalRouter as journalRoutes,
  templatesRouter as templateRoutes,
  exportRouter as exportRoutes,
  pushRouter as pushRoutes,
} from "./modules/tasks/index.js";
import { profileRouter as profileRoutes } from "./modules/profile/index.js";
import notificationRoutes from "./modules/notifications/routes.js";
import { publicRouter as calendarPublicRoutes, authedRouter as calendarAuthedRoutes } from "./modules/calendar/routes.js";
import apiTokenRoutes from "./modules/apiTokens/routes.js";
import { startScheduler } from "./scheduler.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy — nginx ingress forwards X-Forwarded-For
app.set("trust proxy", IS_PROD ? 1 : false);

// Security headers
app.use(helmet({
  contentSecurityPolicy: IS_PROD ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://fcm.googleapis.com", "https://*.push.services.mozilla.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : {
    // Relaxed CSP for dev — Vite HMR needs unsafe-eval and ws connections
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
      fontSrc: ["'self'", "data:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
    : IS_PROD
      ? (origin: string | undefined, cb: (e: Error | null, allow?: boolean) => void) => {
          if (!origin || origin === "null" || origin.endsWith(".byfeb.com")) cb(null, true);
          else cb(new Error("CORS: origin not allowed"));
        }
      : true,
  credentials: true,
}));
// Default body limit — tighter than before (was 1mb)
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());

// Disable caching for API routes — prevents 304 with stale data
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Health check — before auth so k8s probes work without a token
app.get("/api/health", async (_req, res) => {
  const checks: Record<string, string> = {};
  try {
    await pool.query("SELECT 1");
    checks.db = "ok";
  } catch {
    checks.db = "fail";
  }
  checks.redis = isRedisConnected() ? "ok" : "fail";
  const healthy = checks.db === "ok";
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", checks });
});

// Auth routes with auth-specific rate limiter (skip /check — read-only, no brute-force risk)
app.use("/api/auth", getAuthLimiter({ skip: (req) => req.path === "/check" }), authRouter);

// Public calendar feed (GET /api/calendar.ics) — token in query, no session.
// IMPORTANT: limiter and router must mount on the EXACT path. Mounting both at "/api"
// would apply the 30/min/IP limit to every API route — that was a previous bug that
// caused widespread 429s for any authed user behind a shared proxy IP.
const rlCalendarPublic = createRateLimiter(60_000, 30, { perUser: false, prefix: "ical" });
app.use("/api/calendar.ics", rlCalendarPublic);
app.use("/api", calendarPublicRoutes);

// API key approval — one-click from email, no session needed (protected by review_token)
import { approveApiKeyRequest, createApiToken } from "./modules/apiTokens/storage.js";
import { sendApiKeyApprovedEmail } from "./email.js";
app.get("/api/profile/api-key-requests/:id/approve", createRateLimiter(60_000, 10, { perUser: false, prefix: "akr-approve" }), async (req: express.Request, res: express.Response) => {
  const { id } = req.params as { id: string };
  const { token } = req.query as { token?: string };
  if (!token) { res.status(400).send("Token eksik"); return; }
  try {
    const result = await approveApiKeyRequest(id, token);
    if (!result) { res.status(410).send("Geçersiz veya zaten işlenmiş talep."); return; }
    const { raw } = await createApiToken(result.userId, "API Key (Onaylı)");
    sendApiKeyApprovedEmail({ email: result.email, username: result.username }, raw).catch(console.error);
    res.send(`<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#09090b;color:#f0f0f0"><h2 style="color:#4ade80">✓ Onaylandı</h2><p>${result.username} kullanıcısına API key gönderildi.</p></body></html>`);
  } catch { res.status(500).send("Sunucu hatası"); }
});

// Protect all API routes
app.use(authMiddleware);

// SSE /events endpoints are long-lived single connections — exempt them from
// every rate limiter so a single 429 doesn't cause an EventSource reconnect storm.
const isEventsRequest = (req: express.Request) =>
  req.originalUrl.split("?")[0].endsWith("/events");

// Global per-user safety net for all authed /api routes — backstop for misconfigured
// per-route limits and multi-tab usage. Mounted AFTER authMiddleware so req.userId is set;
// IP-based pre-auth surface is already covered by getAuthLimiter + rlCalendarPublic.
app.use("/api", createRateLimiter(60_000, 3000, { perUser: true, prefix: "global-user", skip: isEventsRequest }));

// ── Route-specific rate limiters (per-user, after auth) ──────────
// All instances created at startup — express-rate-limit requires this
const rl = (max: number, windowMs = 60_000, prefix?: string, skip?: (req: express.Request) => boolean) =>
  createRateLimiter(windowMs, max, { perUser: true, prefix, skip });

const rlDaysR    = rl(300, 60_000, "days-r"); // WeekView 7 paralel → ~40 navigasyon/dk headroom
const rlDaysW    = rl(60,  60_000, "days-w");
const rlStats    = rl(60,  60_000, "stats");
const rlSearch   = rl(40,  60_000, "search");
const rlRecurring= rl(30,  60_000, "recurring");
const rlAvatar   = rl(5,   60_000, "avatar");
const rlProfileW = rl(10,  60_000, "profile-w");
const rlCategories = rl(30, 60_000, "categories");
const rlTemplates  = rl(30, 60_000, "templates");
const rlImport   = rl(3,   60_000, "import");
const rlExport   = rl(5,   60_000, "export");
const rlPush     = rl(20,  60_000, "push");
const rlNotifications = rl(120, 60_000, "notifications", isEventsRequest); // skip /events SSE
const rlFeedback  = rl(3,   3_600_000, "feedback"); // 3/saat — email gönderiyor

// days: read-heavy (WeekView fires 7 reqs)
app.use("/api/days", (req, _res, next) => {
  if (req.method === "GET") return rlDaysR(req, _res, next);
  return rlDaysW(req, _res, next);
});
app.use("/api/days", taskRoutes);
app.use("/api/days", planRoutes);
app.use("/api/days", journalRoutes);

app.use("/api/stats", rlStats, statsRoutes);
app.use("/api/search", rlSearch, searchRoutes);
app.use("/api/recurring", rlRecurring, recurringRoutes);

// profile: separate limits for write vs avatar (large payload)
app.use("/api/profile/avatar", express.json({ limit: "250kb" }), rlAvatar);
app.use("/api/profile/feedback", rlFeedback); // email gönderdiği için sıkı limit
app.use("/api/profile", (req, _res, next) => {
  if (req.method === "PUT" || req.method === "POST") return rlProfileW(req, _res, next);
  next();
});
app.use("/api/profile", profileRoutes);

app.use("/api/categories", rlCategories, categoryRoutes);
app.use("/api/templates", rlTemplates, templateRoutes);

// export: heavy DB queries — import needs larger body for bulk data
app.use("/api/export/import", express.json({ limit: "1mb" }), rlImport);
app.use("/api/export", rlExport, exportRoutes);

app.use("/api/push", rlPush, pushRoutes);

app.use("/api/notifications", rlNotifications, notificationRoutes);

// Calendar token management (authed)
const rlCalendarMgmt = rl(10, 60_000, "calendar-mgmt");
app.use("/api/calendar", rlCalendarMgmt, calendarAuthedRoutes);

// Personal Access Tokens — session auth only (cannot manage tokens via token)
const rlApiTokens = rl(10, 60_000, "api-tokens");
app.use("/api/profile/api-tokens", rlApiTokens, apiTokenRoutes);

// Global async error handler — Express 4 doesn't catch async errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err.stack || err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Block bot/scanner probes for common exploit paths — returns 404 quickly
// instead of falling through to SPA index.html (which returns 200 and signals
// "hit" to scanners). Pattern covers .php files, WordPress, env/git leaks,
// phpMyAdmin, common shells, and dotfiles.
const SCANNER_PROBE = /(\.php(\?|$|\/)|^\/+wp[-_/]|^\/+wordpress\b|^\/+phpmyadmin\b|^\/+\.(env|git|aws|ssh|svn|htaccess|htpasswd|DS_Store)\b|^\/+xmlrpc\.php|^\/+\.well-known\/security\.php|^\/+cgi-bin\/|^\/+admin\.php|^\/+shell\b)/i;
app.use((req, res, next) => {
  if (SCANNER_PROBE.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

// Serve frontend in production
const webDist = path.resolve(__dirname, "../../web/dist");
const serveWeb = express.static(webDist);

app.use(serveWeb);

app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

// Notification scheduler — runs every minute
const schedulerInterval = startScheduler();

// Cleanup expired sessions every hour
const cleanupInterval = setInterval(async () => {
  try {
    await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
    // Clean old audit logs (90 days)
    await pool.query("DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'");
    // Clean expired email verification & approval tokens (48h past expiry)
    await pool.query(
      `UPDATE users SET email_token_hash = NULL, email_token_expires_at = NULL
       WHERE email_token_expires_at < NOW() - INTERVAL '48 hours'`
    );
    // Clean stale approval tokens for unapproved users older than 30 days
    await pool.query(
      `UPDATE users SET approval_token_hash = NULL
       WHERE approved = FALSE AND approval_token_hash IS NOT NULL
         AND created_at < NOW() - INTERVAL '30 days'`
    );
  } catch {
    // ignore cleanup errors
  }
}, 60 * 60 * 1000);

async function start() {
  // Connect Redis (non-blocking — app works without it)
  await connectRedis();

  // Run DB migrations
  await runMigrations();

  // Rebuild Redis reminder index from today's unsent items
  if (isRedisConnected()) {
    try {
      const { rows } = await pool.query(
        `SELECT pi.user_id AS "userId", pi.id AS "itemId",
                EXTRACT(EPOCH FROM (pi.date + pi.scheduled_time))::int AS "fireAt"
         FROM plan_items pi
         JOIN users u ON u.id = pi.user_id
         WHERE pi.notification_sent = FALSE
           AND pi.scheduled_time IS NOT NULL
           AND pi.date >= CURRENT_DATE
           AND pi.date <= CURRENT_DATE + 1`
      );
      if (rows.length > 0) {
        await rebuildReminderIndex(rows);
      }
    } catch (err) {
      console.error("[startup] Failed to rebuild reminder index:", err);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    clearInterval(schedulerInterval);
    clearInterval(cleanupInterval);
    server.close();
    await pool.end();
    try { redis.disconnect(); } catch { /* ignore */ }
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
