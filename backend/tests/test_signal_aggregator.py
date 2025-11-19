import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.interfaces.exchange_interface import (
    ExchangeInterface,
    OrderRequest,
    OrderStatus,
    Ticker,
)
from app.services.signal_aggregator import SignalAggregator


class StubRedis:
    def __init__(self):
        self.entries = []

    async def xadd(self, name, fields, maxlen, approximate):
        self.entries.append((name, fields))

    async def xread(self, *_, **__):
        return []

    async def close(self):
        return None


class StubExchange(ExchangeInterface):
    def __init__(self, name: str = "stub"):
        super().__init__(name=name)
        self._queues: dict[str, asyncio.Queue] = {}

    async def connect(self) -> None:
        await self._mark_connected()

    async def disconnect(self) -> None:
        await self._mark_disconnected()

    async def subscribe_ticker(self, symbol: str) -> None:
        self._queues.setdefault(symbol, asyncio.Queue())

    async def unsubscribe_ticker(self, symbol: str) -> None:
        queue = self._queues.get(symbol)
        if queue:
            await queue.put(None)

    def ticker_stream(self, symbol: str):
        queue = self._queues[symbol]

        async def _generator():
            while True:
                tick = await queue.get()
                if tick is None:
                    break
                yield tick

        return _generator()

    async def fetch_balances(self):
        return []

    async def place_order(self, payload: OrderRequest) -> OrderStatus:
        raise NotImplementedError

    async def cancel_order(self, exchange_order_id: str, symbol: str | None = None) -> OrderStatus:
        raise NotImplementedError

    async def fetch_open_orders(self, symbol: str | None = None):
        return []

    async def push_tick(self, symbol: str, tick: Ticker) -> None:
        await self._queues[symbol].put(tick)


@pytest.mark.asyncio
async def test_signal_aggregator_deduplicates_ticks():
    redis = StubRedis()
    exchange = StubExchange()
    aggregator = SignalAggregator(redis_client=redis, stream_key="test", stream_maxlen=10, dedup_ttl=10)

    await aggregator.register_exchange(exchange, ["BTC/USDT"])

    tick = Ticker(exchange="stub", symbol="BTC/USDT", bid=100, ask=101, last=100.5, sequence_id=1)
    await exchange.push_tick("BTC/USDT", tick)
    await exchange.push_tick("BTC/USDT", tick)

    await asyncio.sleep(0.05)

    assert len(redis.entries) == 1

    await aggregator.deregister_exchange(exchange.name)
