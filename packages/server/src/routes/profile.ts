import { Router, type Request, type Response } from "express";
import argon2 from "argon2";
import { UpdateProfileInput, ChangePasswordInput } from "@gmd/shared";
import { getUserProfile, updateUserProfile } from "../storage.js";
import { pool } from "../db.js";

const router = Router();

// GET /api/profile — fetch current user profile
router.get("/", async (req: Request, res: Response) => {
  const profile = await getUserProfile(req.userId!);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(profile);
});

// PUT /api/profile — update profile
router.put("/", async (req: Request, res: Response) => {
  const parsed = UpdateProfileInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const profile = await updateUserProfile(req.userId!, parsed.data);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("email") ? "email" : "username";
      res.status(409).json({ error: `This ${field} is already taken` });
      return;
    }
    throw err;
  }
});

// PUT /api/profile/password — change password
router.put("/password", async (req: Request, res: Response) => {
  const parsed = ChangePasswordInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
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
});

export default router;
