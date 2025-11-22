import type { Env } from "../bindings";
import { errorResponse } from "../utils/response";

type Bucket = {
  count: number;
  reset: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 120;
const DEFAULT_WINDOW = 60;

const getClientId = (request: Request, token?: string) => {
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "anonymous";
  return `${token ?? "public"}:${ip}`;
};

export function applyRateLimit(env: Env, request: Request, token?: string): Response | null {
  const limit = Number(env.RATE_LIMIT_REQUESTS ?? DEFAULT_LIMIT);
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW ?? DEFAULT_WINDOW);
  const now = Math.floor(Date.now() / 1000);
  const key = getClientId(request, token);
  const existing = buckets.get(key);

  if (!existing || existing.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowSeconds });
    return null;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const retry = Math.max(existing.reset - now, 1);
    return errorResponse(env, request, "Rate limit exceeded", 429).clone();
  }
  return null;
}