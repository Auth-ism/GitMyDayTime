import { Router } from "express";
import { authMiddleware } from "../../auth.js";
import {
  getUserNotifications, getUnreadCount,
  markNotificationRead, markAllRead,
} from "./storage.js";

const router = Router();
router.use(authMiddleware);

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get("/", wrap(async (req: any, res: any) => {
  const notifications = await getUserNotifications(req.userId!);
  const unread = await getUnreadCount(req.userId!);
  res.json({ notifications, unread });
}));

router.get("/unread-count", wrap(async (req: any, res: any) => {
  const count = await getUnreadCount(req.userId!);
  res.json({ count });
}));

router.patch("/:id/read", wrap(async (req: any, res: any) => {
  await markNotificationRead(req.params.id, req.userId!);
  res.json({ ok: true });
}));

router.patch("/read-all", wrap(async (req: any, res: any) => {
  await markAllRead(req.userId!);
  res.json({ ok: true });
}));

export default router;
