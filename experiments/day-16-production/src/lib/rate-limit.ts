/**
 * Rate limiter with two tiers:
 *   1. Upstash Redis (production) — persistent, distributed, REQUIRED in prod
 *   2. In-memory fallback (dev only)
 *
 * Limits: 10 messages per IP per day.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const DAILY_LIMIT = 10;

// ── Upstash rate limiter (required in production) ──

let upstashLimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  upstashLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(DAILY_LIMIT, "1 d"),
    analytics: true,
    prefix: "bro-chat",
  });
} else if (process.env.NODE_ENV === "production") {
  // In production, Redis is mandatory — fail hard
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. " +
    "Rate limiting without Redis is unsafe on serverless."
  );
}

// ── In-memory fallback (dev only) ──

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(ip: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { success: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: DAILY_LIMIT - entry.count };
}

// ── Public API ──

export async function checkRateLimit(ip: string): Promise<{
  success: boolean;
  remaining: number;
  limit: number;
}> {
  if (upstashLimiter) {
    const result = await upstashLimiter.limit(ip);
    return {
      success: result.success,
      remaining: result.remaining,
      limit: DAILY_LIMIT,
    };
  }

  // Dev fallback only (production would have thrown above)
  const result = memoryRateLimit(ip);
  return { ...result, limit: DAILY_LIMIT };
}

export { DAILY_LIMIT };
