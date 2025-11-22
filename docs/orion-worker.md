# Orion Worker API

Serverless control-plane API served from Cloudflare Workers with persistent storage in D1. It exposes authenticated CRUD endpoints for users, strategies, trades, and analytics plus an OpenAPI document for client scaffolding.

## Prerequisites

- Node.js 18+
- `wrangler` >= 3.88 (`npm install -g wrangler`)
- Cloudflare account with the D1 beta enabled

## Local Development

```bash
cd workers/orion-api
npm install

# create a local D1 database named orion_d1 (only once)
wrangler d1 create orion_d1

# apply the schema
wrangler d1 execute orion_d1 --local --file=src/db/schema.sql

# run the worker with cloudflared proxy / local persistence
API_KEYS="dev-token" npm run dev -- --persist-to=./.wrangler/state/d1
```

- `API_KEYS` is a comma-separated list of bearer tokens; every request must send `Authorization: Bearer <token>`.
- The dev server automatically mounts the D1 database defined in `wrangler.toml` (`binding = "DB"`).

## Configuration

`wrangler.toml` already defines the required bindings. Override at deploy time via `--var key=value` or environment variables.

| Key | Description | Default |
| --- | --- | --- |
| `API_KEYS` | Comma-separated bearer/API keys allowed to call the worker | _empty (rejects traffic)_ |
| `CORS_ALLOWED_ORIGINS` | CSV allowlist used by `withCors` helper | `http://localhost:5173,https://app.orion` |
| `RATE_LIMIT_REQUESTS` | Requests permitted per window per key/IP | `120` |
| `RATE_LIMIT_WINDOW` | Window length in seconds | `60` |

The D1 database binding (`DB`) must point to a database seeded with `src/db/schema.sql`. In production, run:

```bash
wrangler d1 execute orion_d1 --file=src/db/schema.sql
```

## Deployment

```bash
cd workers/orion-api
API_KEYS="prod-key-1,prod-key-2" wrangler deploy
```

Wrangler will upload the worker, provision the D1 binding declared in `wrangler.toml`, and report the production URL. Re-run the schema execute command when you change `schema.sql`.

## API Surface

- `GET /api/users` — paginated list with cursor & limit query params.
- `POST /api/users` / `PUT /api/users/:id` — mutate profiles; payload validated server-side.
- `GET /api/trades` / `POST /api/trades`
- `GET /api/strategies` / `POST /api/strategies` / `PUT /api/strategies/:id`
- `GET /api/users/:id/trades`
- `GET /api/analytics` — requires `userId` query parameter.
- `POST /api/analytics` — writes analytics snapshots.
- `GET /openapi.json` — served OpenAPI 3.1 spec built from `src/openapi.ts` for client generation.

All endpoints enforce API key auth plus token-scoped rate limits via `authenticate` and `applyRateLimit` middleware. Every JSON response includes CORS headers negotiated in `withCors` so the existing frontend can call the worker directly.

## Testing & Smoke Checks

- `npm run check` — strict TypeScript typecheck (runs in CI and locally).
- `npm run dev` — launches a live-reloading worker; exercise endpoints with `curl` or REST client.
- Use `wrangler d1 execute ... --command "SELECT * FROM users"` to inspect persisted records.

For integration testing, seed fixture rows through the repository helpers or `schema.sql` inserts, then hit `/api/*` endpoints with a valid bearer key.
