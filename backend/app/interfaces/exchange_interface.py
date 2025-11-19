"""Abstract exchange contract for VERIDIAN adapters."""
from __future__ import annotations

import abc
import asyncio
import enum
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Mapping, MutableMapping, Sequence


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class TimeInForce(str, enum.Enum):
    GTC = "gtc"
    IOC = "ioc"
    FOK = "fok"


@dataclass(slots=True, frozen=True)
class OrderRequest:
    """Normalized order payload for downstream routers."""

    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: float | None = None
    client_order_id: str | None = None
    time_in_force: TimeInForce = TimeInForce.GTC
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(slots=True, frozen=True)
class OrderStatus:
    """Execution result for submitted orders."""

    exchange_order_id: str
    client_order_id: str | None
    status: str
    filled_qty: float
    remaining_qty: float
    avg_price: float | None
    raw_response: Mapping[str, Any] = field(default_factory=dict)


@dataclass(slots=True, frozen=True)
class BalanceSnapshot:
    """Represents the balance state of a single asset."""

    asset: str
    free: float
    locked: float
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(tz=timezone.utc),
    )


@dataclass(slots=True, frozen=True)
class Ticker:
    """Normalized tick snapshot pushed through SignalAggregator."""

    exchange: str
    symbol: str
    bid: float
    ask: float
    last: float
    ts: datetime = field(
        default_factory=lambda: datetime.now(tz=timezone.utc),
    )
    sequence_id: int | None = None
    raw: Mapping[str, Any] = field(default_factory=dict)

    def fingerprint(self) -> str:
        """Return a deterministic identifier used for deduplication."""
        seq = self.sequence_id if self.sequence_id is not None else int(self.ts.timestamp() * 1_000_000)
        return f"{self.exchange}:{self.symbol}:{seq}"

    def to_stream_payload(self) -> MutableMapping[str, Any]:
        """Convert the tick into a Redis-friendly payload."""
        payload = asdict(self)
        payload["ts"] = int(self.ts.timestamp() * 1_000)  # milliseconds
        return {k: str(v) for k, v in payload.items() if v is not None}


class ExchangeInterface(abc.ABC):
    """Async adapter contract for any CCXT-compatible exchange."""

    def __init__(self, name: str, throttled: bool = True) -> None:
        self._name = name
        self._connected_event = asyncio.Event()
        self._throttled = throttled
        self._lock = asyncio.Lock()

    @property
    def name(self) -> str:
        return self._name

    def is_connected(self) -> bool:
        return self._connected_event.is_set()

    async def _mark_connected(self) -> None:
        self._connected_event.set()

    async def _mark_disconnected(self) -> None:
        self._connected_event.clear()

    @abc.abstractmethod
    async def connect(self) -> None:
        """Establish underlying REST/WebSocket sessions and prime CCXT clients."""

    @abc.abstractmethod
    async def disconnect(self) -> None:
        """Tear down sessions and flush resources."""

    @abc.abstractmethod
    async def subscribe_ticker(self, symbol: str) -> None:
        """Start streaming ticker data for a symbol."""

    @abc.abstractmethod
    async def unsubscribe_ticker(self, symbol: str) -> None:
        """Stop ticker stream for a symbol."""

    @abc.abstractmethod
    def ticker_stream(self, symbol: str) -> AsyncIterator[Ticker]:
        """Return an async iterator that yields normalized Tick events."""

    @abc.abstractmethod
    async def fetch_balances(self) -> Sequence[BalanceSnapshot]:
        """Return the latest account balances."""

    @abc.abstractmethod
    async def place_order(self, payload: OrderRequest) -> OrderStatus:
        """Submit an order to the venue."""

    @abc.abstractmethod
    async def cancel_order(self, exchange_order_id: str, symbol: str | None = None) -> OrderStatus:
        """Cancel an existing order."""

    @abc.abstractmethod
    async def fetch_open_orders(self, symbol: str | None = None) -> Sequence[OrderStatus]:
        """Retrieve all open orders for the account."""

    async def __aenter__(self) -> "ExchangeInterface":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc, exc_tb) -> None:
        await self.disconnect()


__all__ = [
    "BalanceSnapshot",
    "ExchangeInterface",
    "OrderRequest",
    "OrderSide",
    "OrderStatus",
    "OrderType",
    "Ticker",
    "TimeInForce",
]
