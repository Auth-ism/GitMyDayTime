import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { authMiddleware, authRouter, getAuthLimiter, getGlobalLimiter, createRateLimiter, IS_PROD } from "./auth.js";
import { pool, runMigrations } from "./db.js";
import { connectRedis, redis, isRedisConnected, rebuildReminderIndex } from "./redis.js";
import taskRoutes from "./routes/tasks.js";
import planRoutes from "./routes/plan.js";
import statsRoutes from "./routes/stats.js";
import searchRoutes from "./routes/search.js";
import recurringRoutes from "./routes/recurring.js";
import profileRoutes from "./routes/profile.js";
import categoryRoutes from "./routes/categories.js";
import journalRoutes from "./routes/journal.js";
import templateRoutes from "./routes/templates.js";
import exportRoutes from "./routes/export.js";
import pushRoutes from "./routes/push.js";
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
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://fcm.googleapis.com", "https://*.push.services.mozilla.com"],
      fontSrc: ["'self'"],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || (IS_PROD ? "https://gmd.byfeb.com" : true),
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

// Global rate limiter for all API routes
app.use("/api", getGlobalLimiter());

// Protect all API routes
app.use(authMiddleware);

// ── Route-specific rate limiters (per-user, after auth) ──────────
const rl = (max: number, windowMs = 60_000, prefix?: string) =>
  createRateLimiter(windowMs, max, { perUser: true, prefix });

// days: read-heavy (WeekView fires 7 reqs)
app.use("/api/days", (req, _res, next) => {
  if (req.method === "GET") return rl(120, 60_000, "days-r")(req, _res, next);
  return rl(60, 60_000, "days-w")(req, _res, next);
});
app.use("/api/days", taskRoutes);
app.use("/api/days", planRoutes);
app.use("/api/days", journalRoutes);

app.use("/api/stats", rl(30, 60_000, "stats"), statsRoutes);
app.use("/api/search", rl(20, 60_000, "search"), searchRoutes);
app.use("/api/recurring", rl(30, 60_000, "recurring"), recurringRoutes);

// profile: separate limits for write vs avatar (large payload)
app.use("/api/profile/avatar", express.json({ limit: "250kb" }), rl(5, 60_000, "avatar"));
app.use("/api/profile", (req, _res, next) => {
  if (req.method === "PUT" || req.method === "POST") return rl(10, 60_000, "profile-w")(req, _res, next);
  next();
});
app.use("/api/profile", profileRoutes);

app.use("/api/categories", rl(30, 60_000, "categories"), categoryRoutes);
app.use("/api/templates", rl(30, 60_000, "templates"), templateRoutes);

// export: heavy DB queries — import needs larger body for bulk data
app.use("/api/export/import", express.json({ limit: "1mb" }), rl(3, 60_000, "import"));
app.use("/api/export", rl(5, 60_000, "export"), exportRoutes);

app.use("/api/push", rl(20, 60_000, "push"), pushRoutes);

// Global async error handler — Express 4 doesn't catch async errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err.stack || err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve frontend in production
const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
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
