"""High-throughput signal aggregation service."""
from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, TYPE_CHECKING

try:  # pragma: no cover - import guard for environments without redis-py
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore

if TYPE_CHECKING:  # pragma: no cover
    from redis.asyncio import Redis as RedisType
else:  # pragma: no cover
    RedisType = Any

from app.core.config import settings
from app.interfaces.exchange_interface import ExchangeInterface, Ticker

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Registration:
    exchange: ExchangeInterface
    symbols: Sequence[str]
    tasks: list[asyncio.Task]


class SignalAggregator:
    """Consumes multi-exchange feeds, deduplicates, and publishes to Redis."""

    def __init__(
        self,
        *,
        redis_client: RedisType | None = None,
        stream_key: str | None = None,
        stream_maxlen: int | None = None,
        dedup_ttl: float = 0.250,
    ) -> None:
        self._redis: RedisType | None = redis_client
        self._stream_key = stream_key or settings.redis_stream_key
        self._stream_maxlen = stream_maxlen or settings.redis_stream_maxlen
        self._dedup_ttl = dedup_ttl
        self._registrations: dict[str, Registration] = {}
        self._inflight_fingerprints: dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._shutdown = asyncio.Event()

    async def ensure_started(self) -> None:
        if self._redis is None:
            if aioredis is None:  # pragma: no cover - dependency guard
                raise RuntimeError("redis-py is required but not installed")
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    async def register_exchange(self, exchange: ExchangeInterface, symbols: Sequence[str]) -> None:
        """Attach an exchange feed to the aggregator."""
        await self.ensure_started()
        await exchange.connect()
        for symbol in symbols:
            await exchange.subscribe_ticker(symbol)

        tasks = [
            asyncio.create_task(self._consume_stream(exchange, symbol), name=f"{exchange.name}:{symbol}")
            for symbol in symbols
        ]

        async with self._lock:
            self._registrations[exchange.name] = Registration(exchange=exchange, symbols=symbols, tasks=tasks)

    async def deregister_exchange(self, exchange_name: str) -> None:
        """Detach an exchange feed and stop background tasks."""
        async with self._lock:
            registration = self._registrations.pop(exchange_name, None)

        if not registration:
            return

        for symbol in registration.symbols:
            with contextlib.suppress(Exception):
                await registration.exchange.unsubscribe_ticker(symbol)

        for task in registration.tasks:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

        await registration.exchange.disconnect()

    async def shutdown(self) -> None:
        """Stop all exchange consumers gracefully."""
        self._shutdown.set()
        async with self._lock:
            names = list(self._registrations.keys())

        for name in names:
            await self.deregister_exchange(name)

        if self._redis:
            await self._redis.close()

    async def _consume_stream(self, exchange: ExchangeInterface, symbol: str) -> None:
        try:
            async for tick in exchange.ticker_stream(symbol):
                if self._shutdown.is_set():
                    break
                if not isinstance(tick, Ticker):
                    logger.warning("Non-normalized tick skipped from %s:%s", exchange.name, symbol)
                    continue
                if self._is_duplicate(tick):
                    continue
                await self._publish_tick(tick)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover - safety net
            logger.exception("Signal consumer crashed for %s:%s: %s", exchange.name, symbol, exc)

    def _is_duplicate(self, tick: Ticker) -> bool:
        fingerprint = tick.fingerprint()
        now = asyncio.get_event_loop().time()
        last_seen = self._inflight_fingerprints.get(fingerprint)
        if last_seen and (now - last_seen) <= self._dedup_ttl:
            return True
        self._inflight_fingerprints[fingerprint] = now
        return False

    async def _publish_tick(self, tick: Ticker) -> None:
        if not self._redis:
            raise RuntimeError("Redis client is not initialized")
        payload = tick.to_stream_payload()
        await self._redis.xadd(
            name=self._stream_key,
            fields=payload,
            maxlen=self._stream_maxlen,
            approximate=True,
        )

    async def stream_ticks(self, count: int = 1, block_ms: int = 0) -> list[dict[str, Any]]:
        """Utility method for Celery/FastAPI consumers to read fresh ticks."""
        if not self._redis:
            raise RuntimeError("Redis client is not initialized")
        response = await self._redis.xread({self._stream_key: "$"}, count=count, block=block_ms)
        if not response:
            return []
        # response -> [(stream, [(id, {field: value})])]
        _, entries = response[0]
        return [fields for _, fields in entries]


async def drain(iterator: AsyncIterator[Ticker]) -> list[Ticker]:
    """Exhaust an async iterator into a list (diagnostics/testing helper)."""
    result: list[Ticker] = []
    async for item in iterator:
        result.append(item)
    return result


__all__ = ["SignalAggregator", "drain"]
