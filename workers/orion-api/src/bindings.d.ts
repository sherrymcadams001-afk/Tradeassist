export interface Env {
  DB: D1Database;
  API_KEYS: string;
  CORS_ALLOWED_ORIGINS?: string;
  RATE_LIMIT_REQUESTS?: number;
  RATE_LIMIT_WINDOW?: number;
}