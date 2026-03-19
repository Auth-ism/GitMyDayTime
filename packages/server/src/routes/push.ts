import { Router } from "express";
import { savePushSubscription } from "../storage.js";

const router = Router();

router.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

router.post("/subscribe", async (req, res) => {
  const { subscription } = req.body as { subscription?: PushSubscriptionJSON };
  if (!subscription) return res.status(400).json({ error: "subscription required" });
  await savePushSubscription(req.userId!, subscription);
  res.json({ ok: true });
});

router.delete("/subscribe", async (req, res) => {
  await savePushSubscription(req.userId!, null);
  res.json({ ok: true });
});

export default router;
