import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { authMiddleware, authRouter, getAuthLimiter, getGlobalLimiter } from "./auth.js";
import { pool, runMigrations } from "./db.js";
import { connectRedis, redis } from "./redis.js";
import taskRoutes from "./routes/tasks.js";
import planRoutes from "./routes/plan.js";
import statsRoutes from "./routes/stats.js";

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

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
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Auth routes with auth-specific rate limiter
app.use("/api/auth", getAuthLimiter(), authRouter);

// Global rate limiter for all API routes
app.use("/api", getGlobalLimiter());

// Protect all API routes
app.use(authMiddleware);

app.use("/api/days", taskRoutes);
app.use("/api/days", planRoutes);
app.use("/api/stats", statsRoutes);

// Serve frontend in production
const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

// Cleanup expired sessions every hour
const cleanupInterval = setInterval(async () => {
  try {
    await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
    // Clean old audit logs (90 days)
    await pool.query("DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'");
  } catch {
    // ignore cleanup errors
  }
}, 60 * 60 * 1000);

async function start() {
  // Connect Redis (non-blocking — app works without it)
  await connectRedis();

  // Run DB migrations
  await runMigrations();

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
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
