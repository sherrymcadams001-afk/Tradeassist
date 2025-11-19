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

## Testing & Next Steps

- Backend includes a sample pytest suite (`backend/tests/test_signal_aggregator.py`); run with `pytest` once dependencies are installed
- User acceptance testing can focus on verifying: OHLCV backfill, live ticker cycling, WebSocket updates reflected in RealTimeTicker, and persistence across Docker restarts
- Future work: add production-grade logging, auth, and CI/CD automation once the core loop is validated
