type RouteRegistrar = {
  get: (...args: any[]) => RouteRegistrar;
  post: (...args: any[]) => RouteRegistrar;
};

import type { Env } from "../bindings";
import { authenticate } from "../middleware/auth";
import { applyRateLimit } from "../middleware/rateLimit";
import { analyticsQuerySchema, createAnalyticsRecord, listAnalytics } from "../db/repositories";
import type { AnalyticsRecord } from "../db/repositories";
import { errorResponse, jsonResponse } from "../utils/response";
import { createId } from "../utils/id";

type AnalyticsInput = {
  user_id: string;
  metric: string;
  timeframe: string;
  value: number;
  recorded_at?: number;
};

export function registerAnalyticsRoutes(router: RouteRegistrar) {
  router.get("/api/analytics", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return errorResponse(env, request, "userId is required", 400);
    }
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const query = analyticsQuerySchema.parse({
      user_id: userId,
      metric: url.searchParams.get("metric") ?? undefined,
      timeframe: url.searchParams.get("timeframe") ?? undefined,
      limit,
    });
    try {
      const records = await listAnalytics(env, query);
      return jsonResponse(env, request, records);
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Invalid query", 400);
    }
  });

  router.post("/api/analytics", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const payload = (await request.json()) as AnalyticsInput;
    const timestamp = Math.floor(Date.now() / 1000);
    const record: AnalyticsRecord = {
      id: createId(),
      user_id: payload.user_id,
      metric: payload.metric,
      timeframe: payload.timeframe,
      value: payload.value,
      recorded_at: payload.recorded_at ?? timestamp,
      created_at: timestamp,
    };
    try {
      if (!record.user_id) {
        throw new Error("user_id required");
      }
      if (!record.metric || !record.timeframe) {
        throw new Error("metric and timeframe required");
      }
      if (typeof record.value !== "number" || Number.isNaN(record.value)) {
        throw new Error("value must be numeric");
      }
      await createAnalyticsRecord(env, record);
      return jsonResponse(env, request, record, { status: 201 });
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Unable to create analytics record", 400);
    }
  });
}