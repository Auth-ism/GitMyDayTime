import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { RegisterInput, LoginInput, type UserResponse } from "@gmd/shared";
import { zodMsg } from "./validation.js";
import { pool } from "./db.js";
import { redis, isRedisConnected, cacheSession, getCachedSession, invalidateSessionCache } from "./redis.js";
import { logAuditEvent, getClientIp } from "./audit.js";
import { sendAdminApprovalEmail, sendUserApprovedEmail, sendVerificationEmail, sendPasswordResetEmail } from "./email.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = "15m";
const SESSION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_SESSIONS_PER_USER = 20;

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
  ...(IS_PROD ? { domain: ".byfeb.com" } : {}),
};

function setAccessCookie(res: Response, token: string): void {
  res.cookie("gmd_access", token, { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 });
}

// Legacy domain-specific cookies (set before .byfeb.com domain was used) can
// shadow the new shared cookies because browsers prefer more-specific Domain.
// Always clear them on login so users don't get stuck.
function clearLegacyDomainCookies(res: Response): void {
  if (!IS_PROD) return;
  for (const dom of ["gmd.byfeb.com", "pm.byfeb.com"]) {
    res.clearCookie("gmd_access", { path: "/", domain: dom });
    res.clearCookie("gmd_session", { path: "/", domain: dom });
  }
}

function setCookies(res: Response, accessToken: string, sessionToken: string): void {
  clearLegacyDomainCookies(res);
  setAccessCookie(res, accessToken);
  res.cookie("gmd_session", sessionToken, { ...COOKIE_BASE, maxAge: SESSION_EXPIRES_MS });
}

export function clearCookies(res: Response): void {
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
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
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

  // Enforce max sessions per user — delete oldest beyond limit
  await pool.query(
    `DELETE FROM sessions WHERE id IN (
       SELECT id FROM sessions WHERE user_id = $1
       ORDER BY created_at DESC OFFSET $2
     )`,
    [userId, MAX_SESSIONS_PER_USER]
  );

  await cacheSession(tokenHash, userId, email);
  setCookies(res, signJwt(userId, email), sessionToken);
}

// Rate limiter — Redis-backed if available
export function createRateLimiter(
  windowMs: number,
  max: number,
  opts?: { skip?: (req: Request) => boolean; perUser?: boolean; prefix?: string }
) {
  const limiterOpts: Parameters<typeof rateLimit>[0] = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts?.perUser
      ? (req) => req.userId || getClientIp(req)
      : (req) => getClientIp(req),
    message: { error: "Too many attempts, try again later" },
    ...(opts?.skip && { skip: opts.skip }),
  };

  if (isRedisConnected()) {
    limiterOpts.store = new RedisStore({
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
      prefix: opts?.prefix ? `rl:${opts.prefix}:` : undefined,
    });
  }

  return rateLimit(limiterOpts);
}

export function getAuthLimiter(opts?: { skip?: (req: Request) => boolean }) {
  return createRateLimiter(15 * 60 * 1000, 10, { skip: opts?.skip, prefix: "auth" });
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

// Browsers can hold multiple cookies with the same name but different Domain
// scopes (e.g., legacy Domain=gmd.byfeb.com and new Domain=.byfeb.com). The
// Cookie header then contains the name twice. cookie-parser only exposes one
// of them, so a stale value can mask a valid one. Parse the raw header and
// return all values for `name`.
function getAllCookieValues(req: Request, name: string): string[] {
  const header = req.headers.cookie;
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== name) continue;
    const v = part.slice(eq + 1).trim();
    if (v) out.push(v);
  }
  return out;
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

  // 1. Try every gmd_access JWT (browser may hold duplicates from legacy
  //    subdomain-scoped cookies and new .byfeb.com cookies — try all).
  for (const token of getAllCookieValues(req, "gmd_access")) {
    const userId = verifyJwt(token);
    if (userId) {
      req.userId = userId;
      next();
      return;
    }
  }

  // 2. Try every gmd_session token (same reason as above)
  for (const sessionToken of getAllCookieValues(req, "gmd_session")) {
    const session = await resolveSession(sessionToken, res);
    if (session) {
      req.userId = session.userId;
      next();
      return;
    }
  }

  // 3. Try Authorization: Bearer <personal_access_token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    const { resolveApiToken, touchApiToken } = await import("./modules/apiTokens/storage.js");
    const resolved = await resolveApiToken(raw);
    if (resolved) {
      req.userId = resolved.userId;
      touchApiToken(resolved.tokenId); // fire-and-forget
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
    res.status(400).json({ error: zodMsg(parsed.error) });
    return;
  }

  const { email, username, password } = parsed.data;

  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const passwordHash = await argon2.hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  if (isAdmin) {
    // Admin user — auto-approve and verify
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (email, username, password_hash, approved, email_verified)
         VALUES ($1, $2, $3, TRUE, TRUE)
         RETURNING id, email, username`,
        [email, username, passwordHash]
      );
      const user = rows[0];
      await createSession(user.id, user.email, res, req);
      await logAuditEvent("register", req, user.id, { email, admin: true });
      res.status(201).json({ user: { id: user.id, email: user.email, username: user.username, emailVerified: true } as UserResponse });
      return;
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ error: "Bu bilgiler kullanılamaz" });
        return;
      }
      throw err;
    }
  }

  // Approval token
  const approvalTokenRaw = crypto.randomBytes(32).toString("hex");
  const approvalTokenHash = hashSessionToken(approvalTokenRaw);

  // Email verification token (24h)
  const emailTokenRaw = crypto.randomBytes(32).toString("hex");
  const emailTokenHash = hashSessionToken(emailTokenRaw);
  const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, approved, email_verified, approval_token_hash, email_token_hash, email_token_expires_at)
       VALUES ($1, $2, $3, FALSE, FALSE, $4, $5, $6)
       RETURNING id, email, username`,
      [email, username, passwordHash, approvalTokenHash, emailTokenHash, emailTokenExpires]
    );

    const user = rows[0];
    await logAuditEvent("register", req, user.id, { email });

    // Fire-and-forget — only notify admin for approval
    sendAdminApprovalEmail({ email: user.email, username: user.username }, approvalTokenRaw).catch(console.error);

    res.status(202).json({ pending: true });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Bu bilgiler kullanılamaz" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodMsg(parsed.error) });
    return;
  }

  const { email, password } = parsed.data;
  const { rows } = await pool.query(
    "SELECT id, email, username, password_hash, approved, email_verified FROM users WHERE email = $1 AND deleted_at IS NULL",
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

  if (!user.approved) {
    await logAuditEvent("login_failed", req, user.id, { email, reason: "not_approved" });
    res.status(403).json({ error: "pending_approval" });
    return;
  }

  await createSession(user.id, user.email, res, req);
  await logAuditEvent("login_success", req, user.id, { email });
  res.json({
    user: { id: user.id, email: user.email, username: user.username, emailVerified: user.email_verified ?? false } as UserResponse,
  });
});

authRouter.post("/resend-verification", async (req: Request, res: Response) => {
  const userId = req.cookies?.gmd_access ? verifyJwt(req.cookies.gmd_access) : null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const emailTokenRaw = crypto.randomBytes(32).toString("hex");
  const emailTokenHash = hashSessionToken(emailTokenRaw);
  const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `UPDATE users SET email_token_hash = $1, email_token_expires_at = $2
     WHERE id = $3 AND email_verified = FALSE
     RETURNING email, username`,
    [emailTokenHash, emailTokenExpires, userId]
  );

  if (rows.length > 0) {
    sendVerificationEmail({ email: rows[0].email, username: rows[0].username }, emailTokenRaw).catch(console.error);
  }

  res.json({ ok: true });
});

authRouter.get("/approve", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).send("<p>Geçersiz link.</p>");
    return;
  }

  const tokenHash = hashSessionToken(token);

  // Generate a one-time login token for the approved user
  const loginTokenRaw = crypto.randomBytes(32).toString("hex");
  const loginTokenHash = hashSessionToken(loginTokenRaw);

  const { rows } = await pool.query(
    `UPDATE users SET approved = TRUE, approval_token_hash = $2
     WHERE approval_token_hash = $1 AND approved = FALSE
     RETURNING id, email, username`,
    [tokenHash, loginTokenHash]
  );

  if (rows.length === 0) {
    res.status(400).send("<p>Link geçersiz ya da kullanıcı zaten onaylı.</p>");
    return;
  }

  const user = rows[0];
  await logAuditEvent("user_approved", req, user.id, { email: user.email });
  sendUserApprovedEmail({ email: user.email, username: user.username }, loginTokenRaw).catch(console.error);

  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onaylandı</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px 20px;max-width:400px;margin:0 auto;text-align:center;background:#fafafa;color:#111;">
  <div style="background:#fff;padding:32px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="width:48px;height:48px;background:#16a34a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
      <span style="color:#fff;font-size:24px;">✓</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;">Onaylandı</h2>
    <p style="margin:0;color:#666;font-size:14px;"><strong>${user.username}</strong> hesabı onaylandı.<br/>Kullanıcıya giriş linki gönderildi.</p>
  </div>
</body></html>`);
});

// One-shot login from the approval email link.
// Was previously a GET form + POST submit dance to keep the token out of POST history,
// but production CSP blocks the inline submit script and the user is left stranded.
// Now the GET handler does the work directly: validate token, set session, redirect.
// Token is one-shot (UPDATE clears the hash on first use) and we set Referrer-Policy
// so it won't leak via subsequent resource loads on the redirect target.
async function performAutoLogin(token: string, req: Request, res: Response): Promise<void> {
  if (!/^[0-9a-f]+$/i.test(token)) { res.redirect("/"); return; }

  const tokenHash = hashSessionToken(token);
  const { rows } = await pool.query(
    `UPDATE users SET approval_token_hash = NULL
     WHERE approval_token_hash = $1 AND approved = TRUE AND deleted_at IS NULL
     RETURNING id, email`,
    [tokenHash]
  );
  if (rows.length === 0) { res.redirect("/"); return; }

  const user = rows[0];
  await createSession(user.id, user.email, res, req);
  await logAuditEvent("auto_login", req, user.id, { email: user.email });
  res.setHeader("Referrer-Policy", "no-referrer");
  res.redirect("/");
}

authRouter.get("/auto-login", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) { res.redirect("/"); return; }
  await performAutoLogin(token, req, res);
});

authRouter.post("/auto-login", async (req: Request, res: Response) => {
  const token = req.body?.token as string | undefined;
  if (!token) { res.redirect("/"); return; }
  await performAutoLogin(token, req, res);
});

authRouter.get("/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  const tokenHash = hashSessionToken(token);
  const { rows } = await pool.query(
    `UPDATE users SET email_verified = TRUE, email_token_hash = NULL, email_token_expires_at = NULL
     WHERE email_token_hash = $1 AND email_token_expires_at > NOW()
     RETURNING id`,
    [tokenHash]
  );

  if (rows.length === 0) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  res.json({ ok: true });
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

const forgotPasswordLimiter = createRateLimiter(60 * 60 * 1000, 5, { prefix: "forgot-pw" });

authRouter.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email required" });
    return;
  }

  const { rows } = await pool.query(
    "SELECT id, email, username, approved FROM users WHERE email = $1 AND deleted_at IS NULL",
    [email.toLowerCase().trim()]
  );

  // Always respond OK to prevent email enumeration
  if (rows.length === 0 || !rows[0].approved) {
    res.json({ ok: true });
    return;
  }

  const user = rows[0];
  const tokenRaw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(tokenRaw);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    "UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2 WHERE id = $3",
    [tokenHash, expiresAt, user.id]
  );

  sendPasswordResetEmail({ email: user.email, username: user.username }, tokenRaw).catch(console.error);
  res.json({ ok: true });
});

authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Token and password required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const tokenHash = hashSessionToken(token);
  const { rows } = await pool.query(
    "SELECT id, email FROM users WHERE password_reset_token_hash = $1 AND password_reset_expires_at > NOW() AND deleted_at IS NULL",
    [tokenHash]
  );

  if (rows.length === 0) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }

  const user = rows[0];
  const newHash = await argon2.hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 4 });

  await pool.query(
    "UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = NOW() WHERE id = $2",
    [newHash, user.id]
  );

  await logAuditEvent("password_change", req, user.id, { method: "reset" });
  res.json({ ok: true });
});

authRouter.get("/check", async (req: Request, res: Response) => {
  const accessCount = getAllCookieValues(req, "gmd_access").length;
  const sessionCount = getAllCookieValues(req, "gmd_session").length;
  console.log(`[auth/check] host=${req.hostname} access=${accessCount} session=${sessionCount}`);
  // Try every gmd_access JWT (handle duplicate-domain cookies)
  for (const token of getAllCookieValues(req, "gmd_access")) {
    const userId = verifyJwt(token);
    if (!userId) continue;
    const { rows } = await pool.query(
      "SELECT id, email, username, email_verified FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );
    if (rows.length > 0) {
      const { email_verified, ...rest } = rows[0];
      res.json({ authenticated: true, user: { ...rest, emailVerified: email_verified } as UserResponse });
      return;
    }
  }

  // Try every gmd_session token
  for (const sessionToken of getAllCookieValues(req, "gmd_session")) {
    const session = await resolveSession(sessionToken, res);
    if (!session) continue;
    const { rows } = await pool.query(
      "SELECT id, email, username, email_verified FROM users WHERE id = $1 AND deleted_at IS NULL",
      [session.userId]
    );
    if (rows.length > 0) {
      const { email_verified, ...rest } = rows[0];
      res.json({ authenticated: true, user: { ...rest, emailVerified: email_verified } as UserResponse });
      return;
    }
  }

  res.json({ authenticated: false });
});
