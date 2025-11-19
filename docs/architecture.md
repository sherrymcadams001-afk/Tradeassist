# VERIDIAN System Blueprint

## Architecture Diagram Description
VERIDIAN operates as a modular monolith with clear domain boundaries that map to deployment primitives. MODULE: VORTEX (the zero-cost, high-polish terminal) lives inside the same envelope and extends the Signal Fabric with a Data Engine that can operate offline for backtesting.

- **Edge Layer (FastAPI Gateway):** Terminates TLS, authenticates operator sessions, and fans requests into internal service modules via async dependency injection. The gateway streams outbound UI updates through Server-Sent Events while exposing REST/WebSocket endpoints for control surfaces.
- **Signal Fabric (SignalAggregator + Redis):** Dedicated asyncio service that maintains persistent CCXT-compatible WebSocket clients per exchange. Normalized ticks are shuttled through an in-memory queue, deduplicated, then published into Redis Streams for low-latency fan-out to routers, risk engines, analytics tasks, and the VORTEX Data Engine.
- **Data Engine (MODULE: VORTEX / `backend/market_feed.py`):** A CCXT-powered harvester that cycles through the top 20 Binance pairs, captures OHLCV data to `./data/*.sqlite` (or CSV), and exposes both historical and live ticks over FastAPI WebSockets for the ProfessionalChart HUD.
- **Execution Core (OrderRouter + Celery Workers):** FastAPI triggers enqueue intent packets into Celery. Workers pick up the packets, hydrate strategy context from Redis, and interact with concrete `ExchangeInterface` implementations for deterministic order placement/cancellation with latency safeguards.
- **State Plane (PostgreSQL + Redis):** PostgreSQL persists audit logs, orders, fills, and configuration snapshots. Redis maintains hot state (positions, throttling windows, circuit breaker flags) and backs Celery as both broker and result store.
- **Observation Deck (React/TypeScript HUD):** Real-time dashboard consumes FastAPI SSE/WebSocket feeds. Widgets (e.g., `RealTimeTicker`, `ActiveOrders`) subscribe to normalized topics and render in a high-density grid system styled for “Perception Authority.”

## File & Folder Hierarchy
```
veridian/
├── docs/
│   └── architecture.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── routes.py
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── interfaces/
│   │   │   └── exchange_interface.py
│   │   ├── services/
│   │   │   ├── signal_aggregator.py
│   │   │   └── order_router.py
│   │   └── workers/
│   │       ├── __init__.py
│   │       └── tasks.py
│   ├── market_feed.py
│   └── tests/
│       └── test_exchange_interface.py
└── frontend/
    ├── public/
    └── src/
        ├── components/
        │   └── widgets/
        │       ├── ActiveOrders.tsx
        │       └── RealTimeTicker.tsx
        ├── hooks/
        │   └── useMarketStream.ts
        ├── layout/
        │   └── DashboardGrid.tsx
        └── theme/
            └── palette.ts
├── docker-compose.yml
└── data/
```

This scaffold keeps the monolith internally modular, enabling teams to iterate on exchange adapters, signal ingestion, and UI widgets without tripping over shared infrastructure.
