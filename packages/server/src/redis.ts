import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

let connected = false;

export async function connectRedis(): Promise<boolean> {
  try {
    await redis.connect();
    connected = true;
    console.log("Redis connected");
    return true;
  } catch (err) {
    console.warn("Redis unavailable, falling back to in-memory rate limiting");
    return false;
  }
}

export function isRedisConnected(): boolean {
  return connected && redis.status === "ready";
}

// ── Session cache ────────────────────────────────────────────────

const SESSION_TTL = 300; // 5 min

export async function cacheSession(tokenHash: string, userId: string, email: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.set(`session:${tokenHash}`, JSON.stringify({ userId, email }), "EX", SESSION_TTL);
  } catch { /* ignore */ }
}

export async function getCachedSession(tokenHash: string): Promise<{ userId: string; email: string } | null> {
  if (!isRedisConnected()) return null;
  try {
    const data = await redis.get(`session:${tokenHash}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function invalidateSessionCache(tokenHash: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.del(`session:${tokenHash}`);
  } catch { /* ignore */ }
}

// ── Generic JSON cache ───────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConnected()) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch { /* ignore */ }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!isRedisConnected() || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch { /* ignore */ }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch { /* ignore */ }
}

// ── Reminder sorted set ─────────────────────────────────────────
// Score = Unix timestamp (seconds) when the reminder should fire
// Member = "userId:planItemId"

const REMINDER_KEY = "reminders";

export async function scheduleReminder(userId: string, itemId: string, fireAt: number): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.zadd(REMINDER_KEY, fireAt, `${userId}:${itemId}`);
  } catch { /* ignore */ }
}

export async function unscheduleReminder(userId: string, itemId: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.zrem(REMINDER_KEY, `${userId}:${itemId}`);
  } catch { /* ignore */ }
}

export async function getDueReminders(): Promise<{ userId: string; itemId: string }[]> {
  if (!isRedisConnected()) return [];
  try {
    const now = Math.floor(Date.now() / 1000);
    const members = await redis.zrangebyscore(REMINDER_KEY, 0, now);
    if (members.length === 0) return [];
    // Remove them atomically
    await redis.zremrangebyscore(REMINDER_KEY, 0, now);
    return members.map((m) => {
      const [userId, itemId] = m.split(":");
      return { userId, itemId };
    });
  } catch {
    return [];
  }
}

// ── Per-user SSE (notifications) ─────────────────────────────────

let sseSubscriber: Redis | null = null;
const sseListeners = new Map<string, Set<(msg: string) => void>>();

function getSSESubscriber(): Redis {
  if (!sseSubscriber) {
    sseSubscriber = redis.duplicate();
    sseSubscriber.on("message", (channel, msg) => {
      sseListeners.get(channel)?.forEach((fn) => fn(msg));
    });
  }
  return sseSubscriber;
}

export function subscribeUserEvents(userId: string, fn: (msg: string) => void): () => void {
  const ch = `gmd:user:${userId}:events`;
  if (!sseListeners.has(ch)) {
    sseListeners.set(ch, new Set());
    getSSESubscriber().subscribe(ch).catch(() => {});
  }
  sseListeners.get(ch)!.add(fn);
  return () => {
    const set = sseListeners.get(ch);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      sseListeners.delete(ch);
      getSSESubscriber().unsubscribe(ch).catch(() => {});
    }
  };
}

export async function publishUserEvent(userId: string, event: object): Promise<void> {
  if (!isRedisConnected()) return;
  try { await redis.publish(`gmd:user:${userId}:events`, JSON.stringify(event)); }
  catch { /* ignore */ }
}

export async function rebuildReminderIndex(items: { userId: string; itemId: string; fireAt: number }[]): Promise<void> {
  if (!isRedisConnected() || items.length === 0) return;
  try {
    await redis.del(REMINDER_KEY);
    const pipeline = redis.pipeline();
    for (const { userId, itemId, fireAt } of items) {
      pipeline.zadd(REMINDER_KEY, fireAt, `${userId}:${itemId}`);
    }
    await pipeline.exec();
    console.log(`[redis] Rebuilt reminder index with ${items.length} items`);
  } catch (err) {
    console.error("[redis] Failed to rebuild reminder index:", err);
  }
}
