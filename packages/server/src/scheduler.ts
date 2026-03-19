import twilio from "twilio";
import { getPendingNotifications, markNotificationSent } from "./storage.js";
import { sendReminderEmail } from "./email.js";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

async function sendPendingNotifications(): Promise<void> {
  let pending;
  try {
    pending = await getPendingNotifications();
  } catch (err) {
    console.error("[scheduler] DB error:", err);
    return;
  }

  for (const item of pending) {
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

    await Promise.all(sends);
    await markNotificationSent(item.id).catch((err) =>
      console.error(`[scheduler] markSent failed for ${item.id}:`, err)
    );
  }

  if (pending.length > 0) {
    console.log(`[scheduler] Sent ${pending.length} notification(s)`);
  }
}

export function startScheduler(): NodeJS.Timeout {
  // Run once immediately to catch any missed on startup, then every minute
  sendPendingNotifications();
  return setInterval(sendPendingNotifications, 60_000);
}
