"""MODULE: VORTEX – zero-cost data engine with a $10k terminal polish."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterable, Sequence

import ccxt  # type: ignore
from ccxt.base.errors import ExchangeError, ExchangeNotAvailable, NetworkError
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("veridian.market_feed")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "vortex_ohlcv.sqlite"

TOP_20_PAIRS = [
    "BTC/USDT",
    "ETH/USDT",
    "BNB/USDT",
    "XRP/USDT",
    "SOL/USDT",
    "DOGE/USDT",
    "ADA/USDT",
    "MATIC/USDT",
    "DOT/USDT",
    "LTC/USDT",
    "TRX/USDT",
    "SHIB/USDT",
    "AVAX/USDT",
    "ATOM/USDT",
    "LINK/USDT",
    "XMR/USDT",
    "XLM/USDT",
    "APT/USDT",
    "ARB/USDT",
    "OP/USDT",
]

OHLCV_SCHEMA = """
CREATE TABLE IF NOT EXISTS ohlcv (
    symbol TEXT NOT NULL,
    ts INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    PRIMARY KEY (symbol, ts)
);
"""


def detect_host_environment() -> dict[str, Any]:
    """Return host OS metadata to inform Docker/Desktop tuning."""
    system = platform.system().lower()
    return {
        "system": system,
        "is_windows": system == "windows",
        "docker_profile": "docker-desktop" if system == "windows" else "native",
    }


class DataHarvester:
    """CCXT-powered data service that persists OHLCV locally and streams live ticks."""

    def __init__(
        self,
        *,
        exchange_priority: Sequence[str] | None = None,
        symbols: Iterable[str] | None = None,
    ):
        requested = os.getenv("VERIDIAN_EXCHANGES")
        if requested:
            priority = [ex.strip() for ex in requested.split(",") if ex.strip()]
        elif exchange_priority:
            priority = list(exchange_priority)
        else:
            priority = ["binance", "kraken", "coinbase"]

        if not priority:
            raise ValueError("At least one exchange must be specified")

        self.exchange_priority = priority
        self._active_exchange_idx = 0
        self.exchange = self._bootstrap_exchange(start_index=0)
        self.symbols = list(symbols or TOP_20_PAIRS)
        self.env = detect_host_environment()
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._db_path = DB_PATH
        self._ensure_schema()
        logger.info(
            "DataHarvester initialized (env=%s, exchange=%s)",
            json.dumps(self.env),
            self.exchange_priority[self._active_exchange_idx],
        )

    def _bootstrap_exchange(self, *, start_index: int) -> Any:
        last_exc: Exception | None = None
        total = len(self.exchange_priority)
        for offset in range(total):
            idx = (start_index + offset) % total
            exchange_id = self.exchange_priority[idx]
            try:
                candidate = getattr(ccxt, exchange_id)({"enableRateLimit": True})
                candidate.load_markets()
            except Exception as exc:  # pragma: no cover - network-specific failures
                last_exc = exc
                logger.warning("Exchange %s unavailable: %s", exchange_id, exc)
                continue
            self._active_exchange_idx = idx
            logger.info("Exchange %s online", exchange_id)
            return candidate

        raise RuntimeError(
            f"No exchanges available (tried {self.exchange_priority})"
        ) from last_exc

    def _failover_exchange(self) -> None:
        if len(self.exchange_priority) == 1:
            raise RuntimeError("No fallback exchanges configured; cannot failover")
        next_index = (self._active_exchange_idx + 1) % len(self.exchange_priority)
        previous = self.exchange_priority[self._active_exchange_idx]
        self.exchange = self._bootstrap_exchange(start_index=next_index)
        logger.info("Failover: %s -> %s", previous, self.exchange_priority[self._active_exchange_idx])

    def _ensure_schema(self) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(OHLCV_SCHEMA)
            conn.commit()

    def fetch_live_price(self, symbol: str) -> float:
        """Hit the public ticker endpoint for the latest trade price."""
        for _ in range(len(self.exchange_priority)):
            try:
                ticker = self.exchange.fetch_ticker(symbol)
                return float(ticker["last"])
            except (ExchangeError, NetworkError, ExchangeNotAvailable) as exc:
                logger.warning("Live price fetch failed on %s: %s", getattr(self.exchange, "id", "unknown"), exc)
                self._failover_exchange()
        raise RuntimeError("All exchanges unavailable for live price")

    def backfill_history(self, symbol: str, days: int = 30, timeframe: str = "1m") -> int:
        """Pull >=10k candles (or requested days) and persist to SQLite."""
        cutoff_ms = int(time.time() * 1000) - days * 24 * 60 * 60 * 1000
        since = cutoff_ms
        inserted = 0

        while since < int(time.time() * 1000):
            try:
                batch = self.exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since, limit=1000)
            except (ExchangeError, NetworkError, ExchangeNotAvailable) as exc:
                logger.warning("Backfill failed on %s: %s", getattr(self.exchange, "id", "unknown"), exc)
                self._failover_exchange()
                continue

            if not batch:
                break
            self._persist(symbol, batch)
            inserted += len(batch)
            if len(batch) < 1000 or inserted >= 10_000:
                break
            since = batch[-1][0] + self.exchange.parse_timeframe(timeframe) * 1000

        logger.info("Backfilled %s candles for %s", inserted, symbol)
        return inserted

    def _persist(self, symbol: str, rows: list[list[Any]]) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO ohlcv(symbol, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(symbol, *row) for row in rows],
            )
            conn.commit()

    def load_ohlcv(self, symbol: str, limit: int = 500) -> list[dict[str, Any]]:
        with sqlite3.connect(self._db_path) as conn:
            rows = conn.execute(
                "SELECT ts, open, high, low, close, volume FROM ohlcv WHERE symbol = ? ORDER BY ts DESC LIMIT ?",
                (symbol, limit),
            ).fetchall()
        formatted = [
            {
                "time": row[0] // 1000,
                "open": row[1],
                "high": row[2],
                "low": row[3],
                "close": row[4],
                "volume": row[5],
            }
            for row in reversed(rows)
        ]
        return formatted

    def register(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        self._subscribers.add(queue)
        return queue

    def unregister(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        stale: list[asyncio.Queue[dict[str, Any]]] = []
        for queue in self._subscribers:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                stale.append(queue)
        for queue in stale:
            self.unregister(queue)

    async def cycle_pairs(self, interval_seconds: float = 5.0) -> None:
        while True:
            for symbol in self.symbols:
                price = await asyncio.to_thread(self.fetch_live_price, symbol)
                payload = {
                    "symbol": symbol,
                    "price": price,
                    "ts": int(time.time() * 1000),
                }
                await self.broadcast(payload)
            await asyncio.sleep(interval_seconds)


harvester = DataHarvester()


def fetch_live_price(symbol: str) -> float:
    return harvester.fetch_live_price(symbol)


def backfill_history(symbol: str, days: int = 30) -> int:
    return harvester.backfill_history(symbol, days=days)


app = FastAPI(title="VERIDIAN VORTEX Data Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    app.state.cycle_task = asyncio.create_task(harvester.cycle_pairs(), name="vortex-cycle")
    # Opportunistically backfill the flagship pair on boot so the HUD has history.
    await asyncio.to_thread(harvester.backfill_history, "BTC/USDT", 7)


@app.on_event("shutdown")
async def _shutdown() -> None:
    task: asyncio.Task = app.state.cycle_task
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


@app.websocket("/ws/prices")
async def prices_feed(ws: WebSocket) -> None:
    await ws.accept()
    queue = harvester.register()
    await ws.send_json({"type": "env", "payload": harvester.env})
    try:
        while True:
            payload = await queue.get()
            await ws.send_json({"type": "tick", "payload": payload})
    except WebSocketDisconnect:
        harvester.unregister(queue)
    finally:
        harvester.unregister(queue)


@app.get("/api/ohlcv/{symbol}")
async def get_ohlcv(symbol: str, limit: int = Query(default=500, ge=50, le=5000)) -> dict[str, Any]:
    data = await asyncio.to_thread(harvester.load_ohlcv, symbol, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No OHLCV data for {symbol}")
    return {"symbol": symbol, "candles": data}
