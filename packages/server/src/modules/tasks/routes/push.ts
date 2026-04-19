import { Router, type Request, type Response, type NextFunction } from "express";
import { savePushSubscription } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

router.post("/subscribe", wrap(async (req, res) => {
  const { subscription } = req.body as { subscription?: PushSubscriptionJSON };
  if (!subscription) { res.status(400).json({ error: "subscription required" }); return; }
  await savePushSubscription(req.userId!, subscription);
  res.json({ ok: true });
}));

router.delete("/subscribe", wrap(async (req, res) => {
  await savePushSubscription(req.userId!, null);
  res.json({ ok: true });
}));

export default router;
