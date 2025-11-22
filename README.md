# VERIDIAN · MODULE VORTEX

Enterprise-grade crypto terminal prototype combining a FastAPI data engine (CCXT + SQLite) with a React HUD inspired by Bloomberg/Tactical cockpits. This repo now includes manifests and dual-run instructions so the app can be exercised standalone or inside Docker.

## Repository Layout

```
backend/
  market_feed.py          # FastAPI + CCXT harvester with WebSocket + REST
  app/                    # Modular monolith primitives (FastAPI routing, Celery, Redis fabric)
  tests/                  # pytest coverage for SignalAggregator
  requirements.txt        # Backend dependency lock-in
frontend/
  package.json            # React + Vite + Tailwind manifest
  src/                    # Dashboard, widgets, hooks, layout, theme
  public/                 # Static assets (empty placeholder)
docs/                     # Architecture, integration, and UI guidance
workers/                  # Cloudflare Worker REST API (see docs/orion-worker.md)
docker-compose.yml        # Backend + frontend dev services (ports 8000/5173)
```

## Prerequisites

- **Docker** 24+ (optional but recommended for one-shot startup)
- **Python** 3.11+ if running the backend locally
- **Node.js** 18+ (with npm) for the Vite dashboard

## Option 1 · Docker Dev Stack

```bash
cd /Users/macbookpro/Desktop/Bot/01/veridian
docker-compose up --build
```

- Backend exposes REST + WebSocket at `http://localhost:8000`
- Frontend HUD runs at `http://localhost:5173`
- `./backend/data` is volume-mounted so OHLCV backfills persist across restarts
- On Windows, Docker Desktop (WSL2) is autodetected and the backend logs environment hints on boot

Stop with `Ctrl+C` or `docker-compose down`. Rebuild when manifests change.

## Option 2 · Local Python Backend

```bash
cd /Users/macbookpro/Desktop/Bot/01/veridian/backend
python -m venv .venv
source .venv/bin/activate  # use .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn market_feed:app --reload --host 0.0.0.0 --port 8000
```

- Creates `backend/data/vortex_ohlcv.sqlite` on first run
- Automatic 7-day BTC/USDT backfill occurs at startup so the chart has history
- WebSocket feed lives at `ws://localhost:8000/ws/prices`

## Option 3 · Local Frontend (Vite)

```bash
cd /Users/macbookpro/Desktop/Bot/01/veridian/frontend
npm install
npm run dev
```

- Opens the HUD at `http://localhost:5173`
- Expects the backend at `http://localhost:8000`; override via `.env` or `VITE_API_URL` / `VITE_WS_URL`
- Tailwind is preconfigured; adjust tokens in `src/theme/palette.ts`

## Configuration Notes

- Backend settings live in `backend/app/core/config.py`, reading `.env` if present
- Frontend accepts `VITE_API_URL` and `VITE_WS_URL` for alternate environments
- DataHarvester attempts exchanges in priority order (default: `binance,kraken,coinbase`); set
  `VERIDIAN_EXCHANGES=kraken,coinbase` (comma separated) to skip restricted venues
- Update `TOP_20_PAIRS` in `backend/market_feed.py` to change tracked markets

### Identity & Session Setup

VERIDIAN now requires authenticated sessions before the HUD will render. The backend issues HttpOnly
cookies after completing the Auth0 PKCE flow. Populate the following variables in `backend/.env` (or
the host environment) before launching `uvicorn`:

| Variable | Purpose |
| --- | --- |
| `AUTH0_DOMAIN` | Auth0 tenant (e.g. `your-tenant.us.auth0.com`) |
| `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` | Machine-to-machine client for the dashboard |
| `AUTH0_AUDIENCE` | API audience used when minting access tokens |
| `AUTH0_ROLES_CLAIM` | (Optional) custom claim that enumerates roles (defaults to `https://veridian.ai/roles`) |
| `BACKEND_BASE_URL` | Public callback URL Auth0 should redirect to (e.g. `http://localhost:8000`) |
| `FRONTEND_ORIGIN` | Comma-delimited allow-list for the HUD origins (default `http://localhost:5173`) |
| `SESSION_SECRET` | Random 32+ byte signer secret for cookie integrity |
| `SESSION_COOKIE_NAME` | (Optional) override for the HttpOnly cookie name |
| `SESSION_TTL_SECONDS` | Session lifetime (defaults to 3600) |
| `ENCRYPTION_KEY` | URL-safe base64 Fernet key used to encrypt stored API secrets |

Frontend `.env` should define `VITE_API_URL` so AuthContext knows which origin to call (defaults to
`http://localhost:8000`). When running locally, Auth0 must allow the callback
`http://localhost:8000/auth/callback` and the logout return URL `http://localhost:5173`.

### API Key Vault

- The backend exposes authenticated endpoints under `/v1/api-keys` for listing, creating, and
  deleting encrypted exchange/API credentials. The FastAPI service stores ciphertext inside
  `backend/data/user_secrets.sqlite`.
- The React HUD now includes an **API Key Management** panel rendered under the dashboard. Only users
  with the `admin` role may add or revoke keys; other roles see a read-only notice.
- Secrets are never returned after creation. The frontend sends them over HTTPS and the backend
  encrypts them before persisting. Deletion wipes ciphertext immediately.

## Cloudflare Worker API

- The new control-plane Worker lives in `workers/orion-api`; it serves `/api/users`, `/api/trades`, `/api/strategies`, `/api/analytics`, and `/openapi.json`.
- See `docs/orion-worker.md` for setup, schema migration, and deployment steps.
- Quick start:
  ```bash
  cd workers/orion-api
  npm install
  API_KEYS="dev-token" npm run dev -- --persist-to=./.wrangler/state/d1
  ```
- Apply schema changes with `wrangler d1 execute orion_d1 --file=src/db/schema.sql` before running locally or deploying via `wrangler deploy`.

## API Quick Reference

- `GET /api/health` — returns `status`, `mode` (live vs mock), the active `exchange`, and a preview of tracked symbols so the HUD can display runtime diagnostics.
- `GET /api/ohlcv?symbol=BTC/USDT&limit=720` — primary REST endpoint for historical candles; alternatively, `GET /api/ohlcv/BTC/USDT?limit=720` may be used via the path parameter.
- `WS /ws/prices` — push channel for `tick` packets plus a one-time `env` packet with host diagnostics. The frontend automatically reconnects with jittered retries.

## Testing & Next Steps

- Backend test coverage now spans the session manager, API key vault, and signal aggregator:
  ```bash
  cd backend
  source .venv/bin/activate
  pytest
  ```
- User acceptance testing can focus on verifying: OHLCV backfill, live ticker cycling, WebSocket updates reflected in RealTimeTicker, and persistence across Docker restarts
- Future work: expand RBAC policies, add audit trails for credential updates, and layer on CI/CD automation once the secure core loop is validated
