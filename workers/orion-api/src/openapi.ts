import type { Env } from "./bindings";

const sharedSchemas = {
  User: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string" },
      name: { type: "string" },
      tier: { type: "string" },
      preferences: { type: "object" },
      created_at: { type: "integer" },
      updated_at: { type: "integer" },
    },
  },
  Trade: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string" },
      strategy_id: { type: "string" },
      symbol: { type: "string" },
      side: { type: "string", enum: ["BUY", "SELL"] },
      quantity: { type: "number" },
      price: { type: "number" },
      pnl: { type: "number" },
      status: { type: "string" },
      opened_at: { type: "integer" },
      closed_at: { type: "integer" },
    },
  },
  Strategy: {
    type: "object",
    properties: {
      id: { type: "string" },
      user_id: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      risk_level: { type: "string" },
      status: { type: "string" },
      allocation: { type: "number" },
    },
  },
  AnalyticsRecord: {
    type: "object",
    properties: {
      id: { type: "string" },
      user_id: { type: "string" },
      metric: { type: "string" },
      timeframe: { type: "string" },
      value: { type: "number" },
      recorded_at: { type: "integer" },
    },
  },
};

export function buildOpenApi(env: Env) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Orion Control Plane API",
      version: "v1",
    },
    servers: [{ url: env?.CORS_ALLOWED_ORIGINS?.split(",")[0] ?? "https://api.orion" }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: sharedSchemas,
    },
    security: [{ apiKey: [] }],
    paths: {
      "/api/users": {
        get: {
          summary: "List user profiles",
          responses: {
            200: {
              description: "Users",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: sharedSchemas.User },
                      nextCursor: { type: "integer", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create a user profile",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: sharedSchemas.User,
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/api/users/{id}": {
        get: { summary: "Fetch single user", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "User", content: { "application/json": { schema: sharedSchemas.User } } }, 404: { description: "Missing" } } },
        put: { summary: "Update user", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: sharedSchemas.User } } }, responses: { 200: { description: "Updated" } } },
      },
      "/api/users/{id}/trades": {
        get: {
          summary: "List trades for a user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trades",
              content: { "application/json": { schema: { type: "array", items: sharedSchemas.Trade } } },
            },
          },
        },
      },
      "/api/trades": {
        get: {
          summary: "List trades",
          parameters: [
            { name: "userId", in: "query", schema: { type: "string" } },
            { name: "strategyId", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Trades", content: { "application/json": { schema: { type: "array", items: sharedSchemas.Trade } } } } },
        },
        post: {
          summary: "Create trade",
          requestBody: { required: true, content: { "application/json": { schema: sharedSchemas.Trade } } },
          responses: { 201: { description: "Created" } },
        },
      },
      "/api/strategies": {
        get: {
          summary: "List strategies",
          parameters: [{ name: "userId", in: "query", schema: { type: "string" } }],
          responses: { 200: { description: "Strategies", content: { "application/json": { schema: { type: "array", items: sharedSchemas.Strategy } } } } },
        },
        post: {
          summary: "Create strategy",
          requestBody: { required: true, content: { "application/json": { schema: sharedSchemas.Strategy } } },
          responses: { 201: { description: "Created" } },
        },
      },
      "/api/strategies/{id}": {
        put: {
          summary: "Update strategy",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: sharedSchemas.Strategy } } },
          responses: { 200: { description: "Updated" }, 404: { description: "Not found" } },
        },
      },
      "/api/analytics": {
        get: {
          summary: "Fetch analytics series",
          parameters: [
            { name: "userId", in: "query", required: true, schema: { type: "string" } },
            { name: "metric", in: "query", schema: { type: "string" } },
            { name: "timeframe", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: { 200: { description: "Analytics", content: { "application/json": { schema: { type: "array", items: sharedSchemas.AnalyticsRecord } } } } },
        },
      },
    },
  } as const;
}