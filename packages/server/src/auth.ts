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

export const IS_PROD = process.env.NODE_ENV === "production";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Shared cookie options
const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

function setAccessCookie(res: Response, token: string): void {
  res.cookie("gmd_access", token, { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 });
}

function setCookies(res: Response, accessToken: string, sessionToken: string): void {
  setAccessCookie(res, accessToken);
  res.cookie("gmd_session", sessionToken, { ...COOKIE_BASE, maxAge: SESSION_EXPIRES_MS });
}

function clearCookies(res: Response): void {
  res.clearCookie("gmd_access", COOKIE_BASE);
  res.clearCookie("gmd_session", COOKIE_BASE);
}

function signJwt(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Shared session resolution: cache → DB → null
async function resolveSession(
  sessionToken: string,
  res: Response
): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashSessionToken(sessionToken);

  // Try Redis cache
  const cached = await getCachedSession(tokenHash);
  if (cached) {
    setAccessCookie(res, signJwt(cached.userId, cached.email));
    return cached;
  }

  // DB fallback
  const { rows } = await pool.query(
    `SELECT s.user_id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (rows.length === 0) return null;

  const { user_id, email } = rows[0];
  await cacheSession(tokenHash, user_id, email);
  setAccessCookie(res, signJwt(user_id, email));
  return { userId: user_id, email };
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

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, req.headers["user-agent"] || null, getClientIp(req)]
  );

  await cacheSession(tokenHash, userId, email);
  setCookies(res, signJwt(userId, email), sessionToken);
}

// Rate limiter — Redis-backed if available
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

export function getAuthLimiter() {
  return createRateLimiter(15 * 60 * 1000, 10);
}

export function getGlobalLimiter() {
  return createRateLimiter(60 * 1000, 100);
}

// Verify JWT and return userId, or null
function verifyJwt(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.path.startsWith("/api/auth/") || !req.path.startsWith("/api/")) {
    next();
    return;
  }

  // 1. Try JWT
  const userId = req.cookies?.gmd_access ? verifyJwt(req.cookies.gmd_access) : null;
  if (userId) {
    req.userId = userId;
    next();
    return;
  }

  // 2. Try session token
  const sessionToken = req.cookies?.gmd_session;
  if (sessionToken) {
    const session = await resolveSession(sessionToken, res);
    if (session) {
      req.userId = session.userId;
      next();
      return;
    }
  }

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
    const { rows } = await pool.query("DELETE FROM sessions WHERE token_hash = $1 RETURNING user_id", [tokenHash]);
    await invalidateSessionCache(tokenHash);
    if (rows[0]?.user_id) {
      await logAuditEvent("logout", req, rows[0].user_id);
    }
  }
  clearCookies(res);
  res.status(204).end();
});

authRouter.get("/check", async (req: Request, res: Response) => {
  // Try JWT
  const userId = req.cookies?.gmd_access ? verifyJwt(req.cookies.gmd_access) : null;
  if (userId) {
    const { rows } = await pool.query("SELECT id, email, username FROM users WHERE id = $1", [userId]);
    if (rows.length > 0) {
      res.json({ authenticated: true, user: rows[0] as UserResponse });
      return;
    }
  }

  // Try session token
  const sessionToken = req.cookies?.gmd_session;
  if (sessionToken) {
    const session = await resolveSession(sessionToken, res);
    if (session) {
      const { rows } = await pool.query("SELECT id, email, username FROM users WHERE id = $1", [session.userId]);
      if (rows.length > 0) {
        res.json({ authenticated: true, user: rows[0] as UserResponse });
        return;
      }
    }
  }

  res.json({ authenticated: false });
});
