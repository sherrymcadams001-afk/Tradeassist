import { z } from "zod";

import type { Env } from "../bindings";
import { createId } from "../utils/id";

const baseString = (label: string, min = 1, max = 256) => z.string().min(min, `${label} is required`).max(max, `${label} too long`);

export const userPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  email: baseString("Email"),
  name: baseString("Name", 1, 120).optional(),
  tier: z.enum(["foundation", "advance", "prime"]).optional(),
  preferences: z.record(z.any()).optional(),
});

export type UserPayload = z.infer<typeof userPayloadSchema>;

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  preferences: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

const tradePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  strategy_id: z.string().uuid().nullable().optional(),
  symbol: baseString("Symbol", 1, 32),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  pnl: z.number().optional().default(0),
  status: z.enum(["OPEN", "FILLED", "CANCELLED"]),
  opened_at: z.number().int().positive(),
  closed_at: z.number().int().positive().nullable().optional(),
});

export type TradePayload = z.infer<typeof tradePayloadSchema>;

export type TradeRecord = TradePayload & {
  id: string;
  created_at: number;
  updated_at: number;
};

const strategyPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  name: baseString("Name", 1, 80),
  description: baseString("Description", 0, 640).optional(),
  risk_level: z.enum(["conservative", "balanced", "aggressive"]),
  status: z.enum(["active", "paused", "retired"]).default("active"),
  allocation: z.number().nonnegative().default(0),
});

export type StrategyPayload = z.infer<typeof strategyPayloadSchema>;

export type StrategyRecord = StrategyPayload & {
  id: string;
  created_at: number;
  updated_at: number;
};

export const analyticsQuerySchema = z.object({
  user_id: z.string().uuid(),
  metric: baseString("Metric", 1, 64).optional(),
  timeframe: baseString("Timeframe", 1, 32).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

type AnalyticsFilters = z.infer<typeof analyticsQuerySchema>;

export type AnalyticsRecord = {
  id: string;
  user_id: string;
  metric: string;
  timeframe: string;
  value: number;
  recorded_at: number;
  created_at: number;
};

const parsePreferences = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "string") {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const serializePreferences = (value?: Record<string, unknown>) => JSON.stringify(value ?? {});

export async function listUsers(env: Env, limit = 25, cursor = 0): Promise<{ data: UserRecord[]; nextCursor: number | null }> {
  const stmt = env.DB.prepare(
    `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, cursor);
  const { results } = await stmt.all<UserRecord>();
  const data = (results ?? []).map((row) => ({ ...row, preferences: parsePreferences(row.preferences) }));
  const nextCursor = data.length === limit ? cursor + limit : null;
  return { data, nextCursor };
}

export async function getUser(env: Env, id: string): Promise<UserRecord | null> {
  const { results } = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).all<UserRecord>();
  const record = results?.[0];
  if (!record) return null;
  return { ...record, preferences: parsePreferences(record.preferences) };
}

export async function createUser(env: Env, payload: UserPayload): Promise<UserRecord> {
  const body = userPayloadSchema.parse(payload);
  const id = body.id ?? createId();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, tier, preferences) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, body.email, body.name ?? null, body.tier ?? "foundation", serializePreferences(body.preferences))
    .run();
  const created = await getUser(env, id);
  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}

export async function updateUser(env: Env, id: string, payload: Partial<UserPayload>): Promise<UserRecord | null> {
  const current = await getUser(env, id);
  if (!current) {
    return null;
  }
  const merged = userPayloadSchema.partial().parse({ ...current, ...payload, id });
  await env.DB.prepare(
    `UPDATE users SET email = ?, name = ?, tier = ?, preferences = ?, updated_at = strftime('%s','now') WHERE id = ?`
  )
    .bind(merged.email, merged.name ?? null, merged.tier ?? current.tier, serializePreferences(merged.preferences ?? current.preferences), id)
    .run();
  return getUser(env, id);
}

export async function listTrades(env: Env, filters: { user_id?: string; strategy_id?: string; limit?: number }): Promise<TradeRecord[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.user_id) {
    clauses.push("user_id = ?");
    params.push(filters.user_id);
  }
  if (filters.strategy_id) {
    clauses.push("strategy_id = ?");
    params.push(filters.strategy_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  params.push(limit);
  const query = `SELECT * FROM trades ${where} ORDER BY opened_at DESC LIMIT ?`;
  const { results } = await env.DB.prepare(query).bind(...params).all<TradeRecord>();
  return results ?? [];
}

export async function createTrade(env: Env, payload: TradePayload): Promise<TradeRecord> {
  const body = tradePayloadSchema.parse(payload);
  const id = body.id ?? createId();
  await env.DB.prepare(
    `INSERT INTO trades (id, user_id, strategy_id, symbol, side, quantity, price, pnl, status, opened_at, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, body.user_id, body.strategy_id ?? null, body.symbol, body.side, body.quantity, body.price, body.pnl ?? 0, body.status, body.opened_at, body.closed_at ?? null)
    .run();
  const { results } = await env.DB.prepare(`SELECT * FROM trades WHERE id = ?`).bind(id).all<TradeRecord>();
  const record = results?.[0];
  if (!record) {
    throw new Error("Failed to create trade");
  }
  return record;
}

export async function listStrategies(env: Env, userId?: string): Promise<StrategyRecord[]> {
  let stmt = env.DB.prepare(`SELECT * FROM strategies ORDER BY created_at DESC`);
  if (userId) {
    stmt = env.DB.prepare(`SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC`).bind(userId);
  }
  const { results } = await stmt.all<StrategyRecord>();
  return results ?? [];
}

export async function createStrategy(env: Env, payload: StrategyPayload): Promise<StrategyRecord> {
  const body = strategyPayloadSchema.parse(payload);
  const id = body.id ?? createId();
  await env.DB.prepare(
    `INSERT INTO strategies (id, user_id, name, description, risk_level, status, allocation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, body.user_id, body.name, body.description ?? null, body.risk_level, body.status, body.allocation)
    .run();
  const { results } = await env.DB.prepare(`SELECT * FROM strategies WHERE id = ?`).bind(id).all<StrategyRecord>();
  const record = results?.[0];
  if (!record) {
    throw new Error("Failed to create strategy");
  }
  return record;
}

export async function updateStrategy(env: Env, id: string, payload: Partial<StrategyPayload>): Promise<StrategyRecord | null> {
  const current = await env.DB.prepare(`SELECT * FROM strategies WHERE id = ?`).bind(id).first<StrategyRecord>();
  if (!current) return null;
  const merged = strategyPayloadSchema.partial().parse({ ...current, ...payload, id });
  await env.DB.prepare(
    `UPDATE strategies SET name = ?, description = ?, risk_level = ?, status = ?, allocation = ?, updated_at = strftime('%s','now') WHERE id = ?`
  )
    .bind(merged.name, merged.description ?? null, merged.risk_level, merged.status, merged.allocation, id)
    .run();
  return env.DB.prepare(`SELECT * FROM strategies WHERE id = ?`).bind(id).first<StrategyRecord>();
}

export async function listAnalytics(env: Env, filters: AnalyticsFilters): Promise<AnalyticsRecord[]> {
  const body = analyticsQuerySchema.parse(filters);
  const clauses = ["user_id = ?"];
  const params: unknown[] = [body.user_id];
  if (body.metric) {
    clauses.push("metric = ?");
    params.push(body.metric);
  }
  if (body.timeframe) {
    clauses.push("timeframe = ?");
    params.push(body.timeframe);
  }
  params.push(body.limit);
  const query = `SELECT * FROM analytics_daily WHERE ${clauses.join(" AND ")} ORDER BY recorded_at DESC LIMIT ?`;
  const { results } = await env.DB.prepare(query).bind(...params).all<AnalyticsRecord>();
  return results ?? [];
}

export async function createAnalyticsRecord(env: Env, record: AnalyticsRecord): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO analytics_daily (id, user_id, metric, timeframe, value, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(record.id, record.user_id, record.metric, record.timeframe, record.value, record.recorded_at)
    .run();
}

export const schemas = {
  userPayloadSchema,
  tradePayloadSchema,
  strategyPayloadSchema,
  analyticsQuerySchema,
};