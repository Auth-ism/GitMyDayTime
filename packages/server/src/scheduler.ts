import twilio from "twilio";
import webpush from "web-push";
import { getPendingNotifications, markNotificationSent, getUsersWithPushSubscriptions } from "./storage.js";
import { sendReminderEmail } from "./email.js";
import { getDueReminders, isRedisConnected } from "./redis.js";
import { pool } from "./db.js";

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
  userId: string;
  email: string;
  phoneNumber: string | null;
  smsNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  pushSubscription: any;
}

async function sendNotification(item: NotificationTarget): Promise<void> {
  const label = item.itemType === "reminder" ? "Hatırlatıcı" : "Plan";
  const body = `${label}: ${item.description} (${item.scheduledTime})`;

  const sends: Promise<unknown>[] = [];

  if (item.emailNotifications) {
    sends.push(
      sendReminderEmail(item.email, item.description, item.scheduledTime).catch((err) =>
        console.error(`[scheduler] email failed for ${item.id}:`, err)
      )
    );
  }

  if (item.smsNotifications && twilioClient && TWILIO_FROM && item.phoneNumber) {
    sends.push(
      twilioClient.messages
        .create({ body, from: TWILIO_FROM, to: item.phoneNumber })
        .catch((err) => console.error(`[scheduler] SMS failed for ${item.id}:`, err))
    );
  }

  if (item.pushNotifications && item.pushSubscription && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
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
                u.id AS "userId", u.email,
                u.phone_number AS "phoneNumber",
                u.sms_notifications AS "smsNotifications",
                u.email_notifications AS "emailNotifications",
                u.push_notifications AS "pushNotifications",
                u.push_subscription AS "pushSubscription"
         FROM plan_items pi
         JOIN users u ON u.id = pi.user_id
         WHERE pi.id = $1 AND pi.user_id = $2 AND pi.notification_sent = FALSE`,
        [itemId, userId]
      );
      if (rows.length > 0) {
        await sendNotification(rows[0] as NotificationTarget);
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
    await sendNotification(item as NotificationTarget);
  }
  return pending.length;
}

async function tick(): Promise<void> {
  try {
    let sent = 0;
    if (isRedisConnected()) {
      sent = await processRedisReminders();
    }
    // Always run DB fallback to catch items not in Redis (e.g. added before Redis was connected)
    sent += await processDbReminders();
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
