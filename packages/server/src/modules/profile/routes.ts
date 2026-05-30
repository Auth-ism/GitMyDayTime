import { Router, type Request, type Response, type NextFunction } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import { UpdateProfileInput, ChangePasswordInput } from "@gmd/shared";
import { zodMsg } from "../../validation.js";
import { getUserProfile, updateUserProfile } from "../tasks/storage.js";
import { pool } from "../../db.js";
import { sendVerificationEmail, sendFeedbackEmail, sendApiKeyRequestEmail } from "../../email.js";
import { clearCookies } from "../../auth.js";
import { logAuditEvent } from "../../audit.js";
import { createApiKeyRequest, getApiKeyRequest } from "../apiTokens/storage.js";

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

// POST /api/profile/feedback — send feedback/bug report email to admin
router.post("/feedback", wrap(async (req: Request, res: Response) => {
  const { type, description, url } = req.body as { type?: string; description?: string; url?: string };
  if (!description || description.trim().length < 5) {
    res.status(400).json({ error: "Açıklama çok kısa" }); return;
  }
  const validTypes = ["bug", "feature", "other"];
  const reportType = validTypes.includes(type ?? "") ? type! : "other";

  const { rows } = await pool.query("SELECT email, username FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  try {
    await sendFeedbackEmail({
      senderEmail: user.email as string,
      senderUsername: user.username as string,
      type: reportType,
      description: description.trim(),
      url: url || "(bilinmiyor)",
    });
  } catch {
    // Don't fail the request if email fails — just log
    console.error("Feedback email failed");
  }

  res.json({ ok: true });
}));

// GET /api/profile/api-key-request — current user's request status
router.get("/api-key-request", wrap(async (req: Request, res: Response) => {
  const request = await getApiKeyRequest(req.userId!);
  res.json({ request });
}));

// POST /api/profile/api-key-request — submit a new request
router.post("/api-key-request", wrap(async (req: Request, res: Response) => {
  const { rows: userRows } = await pool.query(
    `SELECT email, username, email_verified FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.userId],
  );
  const user = userRows[0];
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  if (!user.email_verified) { res.status(403).json({ error: "Email doğrulanmamış" }); return; }

  const existing = await getApiKeyRequest(req.userId!);
  if (existing && existing.status === "pending") {
    res.status(409).json({ error: "Zaten bekleyen bir talebiniz var" });
    return;
  }

  const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : undefined;
  const { id, reviewToken } = await createApiKeyRequest(req.userId!, reason || undefined);

  sendApiKeyRequestEmail(
    { email: user.email, username: user.username },
    id,
    reviewToken,
    reason || null,
  ).catch(console.error);

  res.json({ ok: true });
}));

// DELETE /api/profile/account — soft-delete current account (requires password)
// - Sets users.deleted_at = NOW() (data preserved, FKs intact)
// - Removes active session, project memberships and PATs so the user is fully signed out
//   and stops appearing in member lists; comments/audit/plan_items remain by user_id.
// - Email/username freed via partial unique indexes (migration 032), so re-registration
//   creates a fresh user with a new id.
router.delete("/account", wrap(async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Parola gerekli" });
    return;
  }

  const { rows: pwRows } = await pool.query(
    "SELECT password_hash, email FROM users WHERE id = $1 AND deleted_at IS NULL",
    [req.userId]
  );
  if (pwRows.length === 0) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }
  const valid = await argon2.verify(pwRows[0].password_hash, password);
  if (!valid) {
    res.status(400).json({ error: "Parola hatalı" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [req.userId]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [req.userId]);
    await client.query("DELETE FROM project_members WHERE user_id = $1", [req.userId]);
    await client.query("UPDATE user_api_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [req.userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await logAuditEvent("logout", req, req.userId, { reason: "account_deleted", email: pwRows[0].email });

  clearCookies(res);
  res.json({ ok: true });
}));

export default router;
