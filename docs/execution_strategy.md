# Phase 3 – Exchange Integration Strategy

## Objectives
1. Maintain deterministic, low-latency order flow across heterogeneous crypto venues.
2. Encapsulate each exchange behind the `ExchangeInterface` contract to enforce uniform semantics.
3. Leverage Redis Streams and Celery to decouple ingest, decisioning, and execution workloads.

## Integration Plan
1. **Venue Onboarding Checklist**
   - Map REST and WebSocket endpoints.
   - Validate CCXT coverage; if gaps exist, extend via custom transport layer while preserving the ABC contract.
   - Define throttling envelopes (orders/minute, weight units) and encode inside adapter-level rate limiters.
2. **Adapter Implementation**
   - Subclass `ExchangeInterface` under `app/interfaces/exchanges/<venue>.py`.
   - Normalize ticks and order payloads before they hit SignalAggregator/OrderRouter.
   - Coordinate WebSocket reconnect logic with jittered backoff and sequence tracking to avoid data skew.
3. **Signal Path Wiring**
   - Register the adapter with `SignalAggregator` plus the default symbols from `Settings`.
   - Redis Streams propagate ticks; FastAPI SSE/WebSocket endpoints fan them into the HUD.
4. **Execution Path Wiring**
   - `OrderRouter` resolves the venue -> adapter mapping and enqueues Celery tasks for actual placement.
   - Workers hydrate Redis-backed state (positions, throttles) prior to calling `place_order`.
   - Order acknowledgements and fills are mirrored back into PostgreSQL for audit.
5. **Operational Controls**
   - Introduce feature flags per venue (enable/disable ingest or execution independently).
   - Use health probes (FastAPI + Celery Beat) to confirm latency envelopes and trip circuit breakers when SLAs degrade.

## Scaling Considerations
- Batch WebSocket subscriptions per venue to minimize connection churn.
- When horizontal scaling becomes necessary, shard SignalAggregator instances by venue group while keeping Redis as the shared bus.
- Frontend stays agnostic: it subscribes to semantic channels (`ticks`, `orders`, `risk`) rather than venue-specific feeds, enabling rapid expansion without UI churn.
