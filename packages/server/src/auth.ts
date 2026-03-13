import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";

const PASSWORD = process.env.GMD_PASSWORD || "admin";
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Session {
  token: string;
  expiresAt: number;
}

const sessions: Map<string, Session> = new Map();

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(key);
  }
}, 60 * 60 * 1000);

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for login endpoint
  if (req.path === "/api/auth/login" || req.path === "/api/auth/check") {
    next();
    return;
  }

  // Skip auth for non-API routes (static files)
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: "Session expired" });
    return;
  }

  next();
}

export const authRouter = Router();

authRouter.post("/login", (req: Request, res: Response) => {
  const { password } = req.body as { password: string };

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(PASSWORD);
  const received = Buffer.from(password || "");

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }

  const token = generateToken();
  sessions.set(token, {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRY,
  });

  res.json({ token, expiresIn: TOKEN_EXPIRY });
});

authRouter.post("/logout", (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    sessions.delete(header.slice(7));
  }
  res.status(204).end();
});

authRouter.get("/check", (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.json({ authenticated: false });
    return;
  }

  const token = header.slice(7);
  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true });
});
