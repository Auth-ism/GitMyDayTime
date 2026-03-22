import { Router, type Request, type Response, type NextFunction } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import { UpdateProfileInput, ChangePasswordInput } from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { getUserProfile, updateUserProfile } from "../storage.js";
import { pool } from "../db.js";
import { sendVerificationEmail } from "../email.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// GET /api/profile — fetch current user profile
router.get("/", wrap(async (req: Request, res: Response) => {
  const profile = await getUserProfile(req.userId!);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(profile);
}));

// PUT /api/profile — update profile
router.put("/", wrap(async (req: Request, res: Response) => {
  const parsed = UpdateProfileInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodMsg(parsed.error) });
    return;
  }

  const data = parsed.data;

  // If email is being changed, require password confirmation
  if (data.email) {
    const { rows: current } = await pool.query("SELECT email FROM users WHERE id = $1", [req.userId]);
    if (current.length > 0 && data.email !== current[0].email) {
      if (!data.currentPassword) {
        res.status(400).json({ error: "Current password is required to change email" });
        return;
      }
      const { rows: pwRows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
      const valid = await argon2.verify(pwRows[0].password_hash, data.currentPassword);
      if (!valid) {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
      }
      // Set email_verified to false and send verification — single atomic UPDATE
      const emailTokenRaw = crypto.randomBytes(32).toString("hex");
      const emailTokenHash = hashToken(emailTokenRaw);
      const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { rows: userRows } = await pool.query(
        `UPDATE users SET email_verified = FALSE, email_token_hash = $1, email_token_expires_at = $2 WHERE id = $3 RETURNING username`,
        [emailTokenHash, emailTokenExpires, req.userId]
      );
      sendVerificationEmail({ email: data.email, username: userRows[0].username }, emailTokenRaw).catch(console.error);
    }
  }

  // Remove currentPassword from data before passing to storage
  const { currentPassword: _, ...profileData } = data as any;

  try {
    const profile = await updateUserProfile(req.userId!, profileData);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Bu bilgiler kullanılamaz" });
      return;
    }
    throw err;
  }
}));

// Allowed image MIME types and their magic bytes (after base64 decode)
const ALLOWED_AVATAR_TYPES: { mime: string; magic: number[] }[] = [
  { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { mime: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },  // GIF8
];

function isValidImageBase64(dataUri: string): boolean {
  // Must be a data URI
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return false;

  const [, mime, b64] = match;

  // Check MIME is allowed
  const allowed = ALLOWED_AVATAR_TYPES.find((t) => t.mime === mime);
  if (!allowed) return false;

  // Validate magic bytes
  try {
    const buf = Buffer.from(b64.slice(0, 16), "base64");
    return allowed.magic.every((byte, i) => buf[i] === byte);
  } catch {
    return false;
  }
}

// PUT /api/profile/avatar — upload avatar (base64)
router.put("/avatar", wrap(async (req: Request, res: Response) => {
  const { avatar } = req.body;
  if (!avatar || typeof avatar !== "string") {
    res.status(400).json({ error: "Invalid avatar data" });
    return;
  }
  // Max ~150KB base64 (150KB binary ≈ 205K base64 chars + data URI prefix)
  if (avatar.length > 205_000) {
    res.status(400).json({ error: "Avatar too large (max 150KB)" });
    return;
  }
  if (!isValidImageBase64(avatar)) {
    res.status(400).json({ error: "Invalid image format. Allowed: JPEG, PNG, WebP, GIF" });
    return;
  }
  await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatar, req.userId]);
  res.json({ ok: true });
}));

// PUT /api/profile/password — change password
router.put("/password", wrap(async (req: Request, res: Response) => {
  const parsed = ChangePasswordInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodMsg(parsed.error) });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const { rows } = await pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [req.userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await argon2.verify(rows[0].password_hash, currentPassword);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await argon2.hash(newPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await pool.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [newHash, req.userId]
  );

  res.json({ ok: true });
}));

export default router;
