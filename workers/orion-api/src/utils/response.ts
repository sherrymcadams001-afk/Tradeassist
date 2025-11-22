import type { Env } from "../bindings";

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
};

const wildcard = "*" as const;

function resolveOrigin(env: Env, request: Request): string {
  const allowed = (env.CORS_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes("*")) {
    return "*";
  }
  const origin = request.headers.get("Origin") ?? "";
  return allowed.includes(origin) ? origin : allowed[0] ?? "*";
}

export function withCors(env: Env, request: Request, headers?: HeadersInit) {
  const origin = resolveOrigin(env, request);
  return {
    ...defaultHeaders,
    ...headers,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": origin === wildcard ? "false" : "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    Vary: "Origin",
  } satisfies HeadersInit;
}

export function jsonResponse(env: Env, request: Request, body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: withCors(env, request, init?.headers),
  });
}

export function errorResponse(env: Env, request: Request, message: string, status = 400): Response {
  return jsonResponse(env, request, { error: message }, { status });
}