import { pool } from "./db.js";
import { sendWeeklyRecapEmail } from "./email.js";
import { getWeeklyRecapStats } from "./modules/tasks/storage.js";

// Default human labels for built-in categories. Custom categories fall back to their key.
const CATEGORY_LABELS: Record<string, string> = {
  dev: "Geliştirme",
  meeting: "Toplantı",
  review: "İnceleme",
  ops: "DevOps",
  learning: "Öğrenme",
  personal: "Kişisel",
  other: "Diğer",
};

interface RecapCandidate {
  id: string;
  email: string;
  username: string;
  timezone: string;
}

// Compute previous week's Monday/Sunday in the user's timezone, returned as YYYY-MM-DD strings.
async function resolveWeekBounds(userId: string, timezone: string): Promise<{ from: string; to: string }> {
  // Use Postgres date math with the user's TZ so DST and week boundaries stay correct.
  const { rows } = await pool.query(
    `SELECT
       TO_CHAR(((CURRENT_TIMESTAMP AT TIME ZONE $1)::date
                - EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE $1))::int
                - 6)::date, 'YYYY-MM-DD') AS "from",
       TO_CHAR(((CURRENT_TIMESTAMP AT TIME ZONE $1)::date
                - EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE $1))::int)::date, 'YYYY-MM-DD') AS "to"`,
    [timezone],
  );
  void userId;
  return { from: rows[0].from, to: rows[0].to };
}

export async function processWeeklyRecaps(): Promise<number> {
  // Candidates: opt-in users whose local time is Monday 09:xx and who haven't received
  // a recap in the past 6 days. Window is a full hour → we get ~60 tick chances.
  let candidates: RecapCandidate[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, email, username, timezone
       FROM users u
       WHERE u.weekly_recap_enabled = TRUE
         AND u.email_verified = TRUE
         AND EXTRACT(ISODOW FROM (NOW() AT TIME ZONE u.timezone)) = 1
         AND EXTRACT(HOUR   FROM (NOW() AT TIME ZONE u.timezone)) = 9
         AND (
           u.weekly_recap_last_sent_at IS NULL
           OR u.weekly_recap_last_sent_at < NOW() - INTERVAL '6 days'
         )`,
    );
    candidates = rows as RecapCandidate[];
  } catch (err) {
    console.error("[weekly-recap] DB query failed:", err);
    return 0;
  }

  if (candidates.length === 0) return 0;

  let sent = 0;
  for (const user of candidates) {
    try {
      const { from, to } = await resolveWeekBounds(user.id, user.timezone);
      const stats = await getWeeklyRecapStats(user.id, from, to);

      // Skip empty weeks — don't spam inactive users.
      if (stats.totalCompleted === 0) {
        await pool.query(
          `UPDATE users SET weekly_recap_last_sent_at = NOW() WHERE id = $1`,
          [user.id],
        );
        continue;
      }

      await sendWeeklyRecapEmail(
        { email: user.email, username: user.username },
        {
          weekStart: from,
          weekEnd: to,
          totalCompleted: stats.totalCompleted,
          totalMinutes: stats.totalMinutes,
          mostProductiveDay: stats.mostProductiveDay,
          topCategory: stats.topCategory
            ? {
                label: CATEGORY_LABELS[stats.topCategory.key] ?? stats.topCategory.key,
                count: stats.topCategory.count,
              }
            : null,
        },
      );

      await pool.query(
        `UPDATE users SET weekly_recap_last_sent_at = NOW() WHERE id = $1`,
        [user.id],
      );
      sent++;
    } catch (err) {
      console.error(`[weekly-recap] Failed for user ${user.id}:`, err);
    }
  }

  if (sent > 0) console.log(`[weekly-recap] Sent ${sent} recap email(s)`);
  return sent;
}
