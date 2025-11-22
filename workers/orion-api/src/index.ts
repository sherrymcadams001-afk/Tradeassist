import { Router } from "itty-router";

import type { Env } from "./bindings";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerStrategyRoutes } from "./routes/strategies";
import { registerTradeRoutes } from "./routes/trades";
import { registerUserRoutes } from "./routes/users";
import { buildOpenApi } from "./openapi";
import { jsonResponse, withCors } from "./utils/response";

const router = Router();

router.options("*", (request: Request, env: Env) => new Response(null, { headers: withCors(env, request) }));

registerUserRoutes(router);
registerTradeRoutes(router);
registerStrategyRoutes(router);
registerAnalyticsRoutes(router);

router.get("/openapi.json", (request: Request, env: Env) => jsonResponse(env, request, buildOpenApi(env)));

router.all("*", (request: Request, env: Env) => new Response("Not Found", { status: 404, headers: withCors(env, request) }));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
    return router
      .handle(request, env, ctx)
      .catch((err: unknown) => new Response((err as Error).message ?? "Internal error", { status: 500 }));
  },
};