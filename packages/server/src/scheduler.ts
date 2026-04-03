import twilio from "twilio";
import webpush from "web-push";
import { getPendingNotifications, markNotificationSent, markAdvanceNotificationSent, getUpcomingPlanNotifications } from "./storage.js";
import { sendReminderEmail } from "./email.js";
import { getDueReminders, isRedisConnected, redis } from "./redis.js";
import { pool } from "./db.js";
import type { ProjectNotificationEvent } from "./storage/projects.js";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// Set VAPID details at startup
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface NotificationTarget {
  id: string;
  description: string;
  itemType: string;
  scheduledTime: string;
  category: string;
  userId: string;
  email: string;
  phoneNumber: string | null;
  planEmailNotifications: boolean;
  planSmsNotifications: boolean;
  planPushNotifications: boolean;
  reminderEmailNotifications: boolean;
  reminderSmsNotifications: boolean;
  reminderPushNotifications: boolean;
  pushSubscription: any;
  checklistItems?: { description: string; completed: boolean }[];
}

async function fetchChecklist(planId: string): Promise<{ description: string; completed: boolean }[]> {
  try {
    const { rows } = await pool.query(
      "SELECT description, completed FROM plan_checklist WHERE plan_id = $1 ORDER BY sort_order",
      [planId]
    );
    return rows;
  } catch { return []; }
}

async function sendNotification(item: NotificationTarget): Promise<void> {
  const isPlan = item.itemType === "plan";
  const emailEnabled = isPlan ? item.planEmailNotifications : item.reminderEmailNotifications;
  const smsEnabled = isPlan ? item.planSmsNotifications : item.reminderSmsNotifications;
  const pushEnabled = isPlan ? item.planPushNotifications : item.reminderPushNotifications;

  const label = isPlan ? "Plan" : "Hatırlatıcı";
  const body = `${label}: ${item.description} (${item.scheduledTime})`;

  const sends: Promise<unknown>[] = [];

  if (emailEnabled) {
    sends.push(
      sendReminderEmail(item.email, {
        description: item.description,
        scheduledTime: item.scheduledTime,
        itemType: item.itemType as "plan" | "reminder",
        category: item.category,
        checklistItems: item.checklistItems,
      }).catch((err) =>
        console.error(`[scheduler] email failed for ${item.id}:`, err)
      )
    );
  }

  if (smsEnabled && twilioClient && TWILIO_FROM && item.phoneNumber) {
    sends.push(
      twilioClient.messages
        .create({ body, from: TWILIO_FROM, to: item.phoneNumber })
        .catch((err) => console.error(`[scheduler] SMS failed for ${item.id}:`, err))
    );
  }

  if (pushEnabled && item.pushSubscription && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const sub = typeof item.pushSubscription === "string" ? JSON.parse(item.pushSubscription) : item.pushSubscription;
    const payload = JSON.stringify({
      title: label,
      body: `${item.description} — ${item.scheduledTime}`,
    });
    sends.push(
      webpush.sendNotification(sub, payload).catch((err: any) => {
        if (err.statusCode !== 410 && err.statusCode !== 404) {
          console.error(`[scheduler] push failed for ${item.id}:`, err);
        }
      })
    );
  }

  await Promise.all(sends);
  await markNotificationSent(item.id).catch((err) =>
    console.error(`[scheduler] markSent failed for ${item.id}:`, err)
  );
}

// Redis-based: poll the sorted set for due reminders, then look up details
async function processRedisReminders(): Promise<number> {
  const due = await getDueReminders();
  if (due.length === 0) return 0;

  let sent = 0;
  for (const { userId, itemId } of due) {
    try {
      const { rows } = await pool.query(
        `SELECT pi.id, pi.description, pi.item_type AS "itemType",
                TO_CHAR(pi.scheduled_time, 'HH24:MI') AS "scheduledTime",
                pi.category,
                u.id AS "userId", u.email,
                u.phone_number AS "phoneNumber",
                u.plan_email_notifications AS "planEmailNotifications",
                u.plan_sms_notifications AS "planSmsNotifications",
                u.plan_push_notifications AS "planPushNotifications",
                u.reminder_email_notifications AS "reminderEmailNotifications",
                u.reminder_sms_notifications AS "reminderSmsNotifications",
                u.reminder_push_notifications AS "reminderPushNotifications",
                u.push_subscription AS "pushSubscription"
         FROM plan_items pi
         JOIN users u ON u.id = pi.user_id
         WHERE pi.id = $1 AND pi.user_id = $2 AND pi.notification_sent = FALSE`,
        [itemId, userId]
      );
      if (rows.length > 0) {
        const target = rows[0] as NotificationTarget;
        if (target.itemType === "plan") {
          target.checklistItems = await fetchChecklist(target.id);
        }
        await sendNotification(target);
        sent++;
      }
    } catch (err) {
      console.error(`[scheduler] Redis reminder error for ${itemId}:`, err);
    }
  }
  return sent;
}

// DB fallback: poll the DB for items due this minute (original approach)
async function processDbReminders(): Promise<number> {
  let pending;
  try {
    pending = await getPendingNotifications();
  } catch (err) {
    console.error("[scheduler] DB error:", err);
    return 0;
  }

  for (const item of pending) {
    const target = item as unknown as NotificationTarget;
    if (target.itemType === "plan") {
      target.checklistItems = await fetchChecklist(target.id);
    }
    await sendNotification(target);
  }
  return pending.length;
}

// Advance notifications: push "N minutes until X" before the item starts
async function processAdvanceNotifications(): Promise<number> {
  let pending;
  try {
    pending = await getUpcomingPlanNotifications();
  } catch (err) {
    console.error("[scheduler] advance notifications DB error:", err);
    return 0;
  }

  let sent = 0;
  for (const item of pending) {
    const target = item as unknown as NotificationTarget;
    if (!target.pushSubscription || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) continue;
    try {
      const sub = typeof target.pushSubscription === "string"
        ? JSON.parse(target.pushSubscription)
        : target.pushSubscription;
      const payload = JSON.stringify({
        title: "Yaklaşan Görev",
        body: `${target.description} — ${target.scheduledTime}`,
        tag: `advance-${target.id}`,
      });
      await webpush.sendNotification(sub, payload).catch((err: any) => {
        if (err.statusCode !== 410 && err.statusCode !== 404) {
          console.error(`[scheduler] advance push failed for ${target.id}:`, err);
        }
      });
      await markAdvanceNotificationSent(target.id).catch((err) =>
        console.error(`[scheduler] markAdvanceSent failed for ${target.id}:`, err)
      );
      sent++;
    } catch (err) {
      console.error(`[scheduler] advance notification error for ${item.id}:`, err);
    }
  }
  return sent;
}

async function processProjectNotifications(): Promise<number> {
  if (!isRedisConnected()) return 0;
  let sent = 0;
  for (let i = 0; i < 30; i++) {
    const raw = await redis.rpop("gmd:pm:notify");
    if (!raw) break;
    try {
      const ev: ProjectNotificationEvent = JSON.parse(raw);
      const targetUserId = "assigneeId" in ev ? ev.assigneeId
                         : "mentionedId" in ev ? ev.mentionedId
                         : null;
      if (!targetUserId) continue;

      const { rows } = await pool.query(
        `SELECT push_subscription, email, plan_push_notifications, plan_email_notifications
         FROM users u
         JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id = $1`, [targetUserId]
      );
      if (!rows.length) continue;
      const user = rows[0];

      if (user.plan_push_notifications && user.push_subscription && process.env.VAPID_PUBLIC_KEY) {
        const sub = typeof user.push_subscription === "string"
          ? JSON.parse(user.push_subscription) : user.push_subscription;
        const { title, body, tag } = buildProjectPushPayload(ev);
        await webpush.sendNotification(sub, JSON.stringify({ title, body, tag })).catch((e: any) => {
          if (e.statusCode !== 410 && e.statusCode !== 404)
            console.error("[scheduler] pm push failed:", e);
        });
      }
      sent++;
    } catch (err) {
      console.error("[scheduler] pm notification error:", err);
    }
  }
  return sent;
}

function buildProjectPushPayload(ev: ProjectNotificationEvent): { title: string; body: string; tag: string } {
  switch (ev.type) {
    case "issue_assigned":
      return { title: `${ev.projectName}: Görev Atandı`, body: `${ev.assignerName}: ${ev.issueTitle}`, tag: `issue-${ev.issueId}` };
    case "comment_mention":
      return { title: `${ev.projectName}: ${ev.authorName} sizi etiketledi`, body: ev.commentPreview, tag: `comment-${ev.issueId}` };
    case "issue_done":
      return { title: `${ev.issueKey} tamamlandı`, body: `${ev.changerName} → ${ev.toStatus}`, tag: `done-${ev.issueId}` };
    default:
      return { title: "GMD", body: "", tag: "gmd" };
  }
}

async function tick(): Promise<void> {
  try {
    let sent = 0;
    if (isRedisConnected()) {
      sent = await processRedisReminders();
      sent += await processProjectNotifications();
    }
    // Always run DB fallback to catch items not in Redis (e.g. added before Redis was connected)
    sent += await processDbReminders();
    // Advance notifications (X minutes before scheduled time)
    sent += await processAdvanceNotifications();
    if (sent > 0) {
      console.log(`[scheduler] Sent ${sent} notification(s)`);
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
  }
}

export function startScheduler(): NodeJS.Timeout {
  tick();
  return setInterval(tick, 60_000);
}
