import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { zodMsg } from "../../validation.js";
import { listApiTokens, createApiToken, revokeApiToken } from "./storage.js";

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

const CreateTokenInput = z.object({
  name: z.string().min(1).max(64),
});

const router = Router();

// Block management via Bearer token — must be session/JWT (browser only)
router.use((req, res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    res.status(403).json({ error: "Token management requires browser session" });
    return;
  }
  next();
});

router.get("/", wrap(async (req, res) => {
  const tokens = await listApiTokens(req.userId!);
  res.json({ tokens });
}));

router.post("/", wrap(async (req, res) => {
  const parsed = CreateTokenInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodMsg(parsed.error) });
    return;
  }
  const { id, raw } = await createApiToken(req.userId!, parsed.data.name);
  res.status(201).json({ id, token: raw, name: parsed.data.name });
}));

router.delete("/:id", wrap(async (req, res) => {
  const ok = await revokeApiToken(req.userId!, req.params.id as string);
  if (!ok) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  res.status(204).end();
}));

export default router;
