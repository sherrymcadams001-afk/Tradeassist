type RouteRegistrar = {
  get: (...args: any[]) => RouteRegistrar;
  post: (...args: any[]) => RouteRegistrar;
};

import type { Env } from "../bindings";
import { authenticate } from "../middleware/auth";
import { applyRateLimit } from "../middleware/rateLimit";
import { createTrade, listTrades } from "../db/repositories";
import type { TradePayload } from "../db/repositories";
import { errorResponse, jsonResponse } from "../utils/response";

export function registerTradeRoutes(router: RouteRegistrar) {
  router.get("/api/trades", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const strategyId = url.searchParams.get("strategyId") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const trades = await listTrades(env, { user_id: userId, strategy_id: strategyId, limit });
    return jsonResponse(env, request, trades);
  });

  router.post("/api/trades", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const payload = (await request.json()) as TradePayload;
    try {
      const trade = await createTrade(env, payload);
      return jsonResponse(env, request, trade, { status: 201 });
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Unable to store trade", 400);
    }
  });
}