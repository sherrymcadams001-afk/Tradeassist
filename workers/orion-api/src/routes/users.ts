type RouteRegistrar = {
  get: (...args: any[]) => RouteRegistrar;
  post: (...args: any[]) => RouteRegistrar;
  put: (...args: any[]) => RouteRegistrar;
};

import type { Env } from "../bindings";
import { authenticate } from "../middleware/auth";
import { applyRateLimit } from "../middleware/rateLimit";
import { createUser, getUser, listTrades, listUsers, updateUser } from "../db/repositories";
import type { UserPayload } from "../db/repositories";
import { errorResponse, jsonResponse } from "../utils/response";

const parseCursor = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function registerUserRoutes(router: RouteRegistrar) {
  router.get("/api/users", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
    const cursor = parseCursor(url.searchParams.get("cursor"));
    const result = await listUsers(env, limit, cursor);
    return jsonResponse(env, request, result);
  });

  router.post("/api/users", async (request: Request, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    try {
      const body = (await request.json()) as UserPayload;
      const created = await createUser(env, body);
      return jsonResponse(env, request, created, { status: 201 });
    } catch (err) {
      return errorResponse(env, request, err instanceof Error ? err.message : "Unable to create user", 400);
    }
  });

  router.get("/api/users/:id", async (request: Request & { params: { id: string } }, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const record = await getUser(env, request.params.id);
    if (!record) {
      return errorResponse(env, request, "User not found", 404);
    }
    return jsonResponse(env, request, record);
  });

  router.put("/api/users/:id", async (request: Request & { params: { id: string } }, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const payload = (await request.json()) as Partial<UserPayload>;
    const updated = await updateUser(env, request.params.id, payload);
    if (!updated) {
      return errorResponse(env, request, "User not found", 404);
    }
    return jsonResponse(env, request, updated);
  });

  router.get("/api/users/:id/trades", async (request: Request & { params: { id: string } }, env: Env) => {
    const auth = authenticate(env, request);
    if (auth instanceof Response) return auth;
    const rate = applyRateLimit(env, request, auth.keyId);
    if (rate) return rate;
    const trades = await listTrades(env, { user_id: request.params.id, limit: 100 });
    return jsonResponse(env, request, trades);
  });
}