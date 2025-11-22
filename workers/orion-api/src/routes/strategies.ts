type RouteRegistrar = {
  get: (...args: any[]) => RouteRegistrar;
  post: (...args: any[]) => RouteRegistrar;
  put: (...args: any[]) => RouteRegistrar;
};

import type { Env } from "../bindings";
import { authenticate } from "../middleware/auth";
import { applyRateLimit } from "../middleware/rateLimit";
import { createStrategy, listStrategies, updateStrategy } from "../db/repositories";
import type { StrategyPayload } from "../db/repositories";
import { errorResponse, jsonResponse } from "../utils/response";

export function registerStrategyRoutes(router: RouteRegistrar) {
  router.get("/api/strategies", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const data = await listStrategies(env, userId);
    return jsonResponse(env, request, data);
  });

  router.post("/api/strategies", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const payload = (await request.json()) as StrategyPayload;
    try {
      const record = await createStrategy(env, payload);
      return jsonResponse(env, request, record, { status: 201 });
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Unable to create strategy", 400);
    }
  });

  router.put("/api/strategies/:id", async (request: Request & { params: { id: string } }, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const payload = (await request.json()) as Partial<StrategyPayload>;
    try {
      const record = await updateStrategy(env, request.params.id, payload);
      if (!record) {
        return errorResponse(env, request, "Strategy not found", 404);
      }
      return jsonResponse(env, request, record);
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Unable to update strategy", 400);
    }
  });
}