import Redis from "ioredis";
import { ApiError } from "./errors";
export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { lazyConnect: true, maxRetriesPerRequest: 1 },
);
export async function rateLimit(key: string, limit = 60) {
  const count = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
    1,
    `rate:${key}`,
  );
  if (Number(count) > limit) throw new ApiError(429, "RATE_LIMITED");
}
