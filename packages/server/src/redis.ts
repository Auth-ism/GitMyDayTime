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

// Session cache helpers — cache session lookups to avoid DB hits
const SESSION_CACHE_TTL = 300; // 5 min

export async function cacheSession(tokenHash: string, userId: string, email: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redis.set(
      `session:${tokenHash}`,
      JSON.stringify({ userId, email }),
      "EX",
      SESSION_CACHE_TTL
    );
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
