import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { RegisterInput, LoginInput, type UserResponse } from "@gmd/shared";
import { pool } from "./db.js";
import { redis, isRedisConnected, cacheSession, getCachedSession, invalidateSessionCache } from "./redis.js";
import { logAuditEvent, getClientIp } from "./audit.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = "15m";
const SESSION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IS_PROD = process.env.NODE_ENV === "production";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function setCookies(res: Response, accessToken: string, sessionToken: string): void {
  const cookieBase = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };

  res.cookie("gmd_access", accessToken, {
    ...cookieBase,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("gmd_session", sessionToken, {
    ...cookieBase,
    maxAge: SESSION_EXPIRES_MS,
  });
}

function clearCookies(res: Response): void {
  const cookieBase = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };
  res.clearCookie("gmd_access", cookieBase);
  res.clearCookie("gmd_session", cookieBase);
}

function signJwt(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(
  userId: string,
  email: string,
  res: Response,
  req: Request
): Promise<void> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_MS);
  const ip = getClientIp(req);

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, req.headers["user-agent"] || null, ip]
  );

  // Cache in Redis
  await cacheSession(tokenHash, userId, email);

  const accessToken = signJwt(userId, email);
  setCookies(res, accessToken, sessionToken);
}

// Rate limiter — Redis-backed if available, in-memory fallback
function createRateLimiter(windowMs: number, max: number) {
  const opts: Parameters<typeof rateLimit>[0] = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    message: { error: "Too many attempts, try again later" },
  };

  if (isRedisConnected()) {
    opts.store = new RedisStore({
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
    });
  }

  return rateLimit(opts);
}

// Auth rate limiter: 10 per 15 min per IP
export function getAuthLimiter() {
  return createRateLimiter(15 * 60 * 1000, 10);
}

// Global API rate limiter: 100 per min per IP
export function getGlobalLimiter() {
  return createRateLimiter(60 * 1000, 100);
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for auth endpoints and static files
  if (req.path.startsWith("/api/auth/") || !req.path.startsWith("/api/")) {
    next();
    return;
  }

  // 1. Try JWT from cookie
  const accessToken = req.cookies?.gmd_access;
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, JWT_SECRET) as { sub: string };
      req.userId = payload.sub;
      next();
      return;
    } catch {
      // JWT expired or invalid, fall through to session check
    }
  }

  // 2. Try session token from cookie
  const sessionToken = req.cookies?.gmd_session;
  if (sessionToken) {
    const tokenHash = hashSessionToken(sessionToken);

    // Try Redis cache first
    const cached = await getCachedSession(tokenHash);
    if (cached) {
      req.userId = cached.userId;
      const newAccessToken = signJwt(cached.userId, cached.email);
      res.cookie("gmd_access", newAccessToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000,
      });
      next();
      return;
    }

    // Fall back to DB
    const { rows } = await pool.query(
      `SELECT s.user_id, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length > 0) {
      const { user_id, email } = rows[0];
      req.userId = user_id;

      // Warm cache
      await cacheSession(tokenHash, user_id, email);

      const newAccessToken = signJwt(user_id, email);
      res.cookie("gmd_access", newAccessToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000,
      });
      next();
      return;
    }
  }

  // 3. Neither valid
  res.status(401).json({ error: "Unauthorized" });
}

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, username, password } = parsed.data;

  const passwordHash = await argon2.hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [email, username, passwordHash]
    );

    const user = rows[0] as UserResponse;
    await createSession(user.id, user.email, res, req);
    await logAuditEvent("register", req, user.id, { email });
    res.status(201).json({ user });
  } catch (err: any) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("email") ? "email" : "username";
      res.status(409).json({ error: `This ${field} is already taken` });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const { rows } = await pool.query(
    "SELECT id, email, username, password_hash FROM users WHERE email = $1",
    [email]
  );

  if (rows.length === 0) {
    await logAuditEvent("login_failed", req, undefined, { email, reason: "unknown_email" });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const user = rows[0];
  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    await logAuditEvent("login_failed", req, user.id, { email, reason: "wrong_password" });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await createSession(user.id, user.email, res, req);
  await logAuditEvent("login_success", req, user.id, { email });
  res.json({
    user: { id: user.id, email: user.email, username: user.username } as UserResponse,
  });
});

authRouter.post("/logout", async (req: Request, res: Response) => {
  const sessionToken = req.cookies?.gmd_session;
  if (sessionToken) {
    const tokenHash = hashSessionToken(sessionToken);

    // Get user_id before deleting for audit
    const { rows } = await pool.query(
      "SELECT user_id FROM sessions WHERE token_hash = $1",
      [tokenHash]
    );
    const userId = rows[0]?.user_id;

    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    await invalidateSessionCache(tokenHash);

    if (userId) {
      await logAuditEvent("logout", req, userId);
    }
  }
  clearCookies(res);
  res.status(204).end();
});

authRouter.get("/check", async (req: Request, res: Response) => {
  // Try JWT first
  const accessToken = req.cookies?.gmd_access;
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, JWT_SECRET) as { sub: string };
      const { rows } = await pool.query(
        "SELECT id, email, username FROM users WHERE id = $1",
        [payload.sub]
      );
      if (rows.length > 0) {
        res.json({ authenticated: true, user: rows[0] as UserResponse });
        return;
      }
    } catch {
      // fall through
    }
  }

  // Try session token
  const sessionToken = req.cookies?.gmd_session;
  if (sessionToken) {
    const tokenHash = hashSessionToken(sessionToken);

    // Try cache
    const cached = await getCachedSession(tokenHash);
    if (cached) {
      const { rows } = await pool.query(
        "SELECT id, email, username FROM users WHERE id = $1",
        [cached.userId]
      );
      if (rows.length > 0) {
        const user = rows[0] as UserResponse;
        const newAccessToken = signJwt(user.id, user.email);
        res.cookie("gmd_access", newAccessToken, {
          httpOnly: true,
          secure: IS_PROD,
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60 * 1000,
        });
        res.json({ authenticated: true, user });
        return;
      }
    }

    // DB fallback
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );
    if (rows.length > 0) {
      const user = rows[0] as UserResponse;
      await cacheSession(tokenHash, user.id, user.email);
      const newAccessToken = signJwt(user.id, user.email);
      res.cookie("gmd_access", newAccessToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000,
      });
      res.json({ authenticated: true, user });
      return;
    }
  }

  res.json({ authenticated: false });
});
