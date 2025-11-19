"""Order routing orchestration layer."""
from __future__ import annotations

import asyncio
from typing import Mapping, Sequence

from app.interfaces.exchange_interface import ExchangeInterface, OrderRequest, OrderStatus


class OrderRouter:
    """Fan orders to the correct exchange with concurrency-safe access."""

    def __init__(self, exchanges: Mapping[str, ExchangeInterface]) -> None:
        self._exchanges = dict(exchanges)
        self._lock = asyncio.Lock()

    def register_exchange(self, exchange: ExchangeInterface) -> None:
        self._exchanges[exchange.name] = exchange

    async def route(self, payload: OrderRequest, venue: str) -> OrderStatus:
        async with self._lock:
            exchange = self._exchanges.get(venue)
            if not exchange:
                raise ValueError(f"Exchange {venue} is not registered")
            if not exchange.is_connected():
                await exchange.connect()
            return await exchange.place_order(payload)

    async def cancel(self, venue: str, exchange_order_id: str, symbol: str | None = None) -> OrderStatus:
        exchange = self._exchanges.get(venue)
        if not exchange:
            raise ValueError(f"Exchange {venue} is not registered")
        return await exchange.cancel_order(exchange_order_id, symbol=symbol)

    async def open_orders(self, venue: str, symbol: str | None = None) -> Sequence[OrderStatus]:
        exchange = self._exchanges.get(venue)
        if not exchange:
            raise ValueError(f"Exchange {venue} is not registered")
        return await exchange.fetch_open_orders(symbol=symbol)
