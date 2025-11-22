import type { Env } from "../bindings";
import { errorResponse } from "../utils/response";

const HEADER = "authorization";

export type AuthContext = {
  keyId: string;
};

export function authenticate(env: Env, request: Request): AuthContext | Response {
  const configured = (env.API_KEYS ?? "").split(",").map((token) => token.trim()).filter(Boolean);
  if (!configured.length) {
    return errorResponse(env, request, "API keys not configured", 500);
  }
  const header = request.headers.get(HEADER) ?? request.headers.get("x-api-key");
  if (!header) {
    return errorResponse(env, request, "Missing authorization", 401);
  }
  let token = header;
  if (header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  }
  const match = configured.find((item) => item === token);
  if (!match) {
    return errorResponse(env, request, "Invalid credentials", 401);
  }
  return { keyId: match };
}