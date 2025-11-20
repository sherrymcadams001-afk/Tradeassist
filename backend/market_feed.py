"""MODULE: VORTEX – zero-cost data engine with a $10k terminal polish."""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import platform
import random
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterable, Sequence

import ccxt  # type: ignore
from ccxt.base.errors import ExchangeError, ExchangeNotAvailable, NetworkError
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import router as control_router

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


def timeframe_to_ms(timeframe: str) -> int:
    unit = timeframe[-1]
    value = int(timeframe[:-1])
    factors = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    if unit not in factors:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    return value * factors[unit] * 1000


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
        self.exchange: Any | None = None
        self._mock_mode = False
        self._mock_seed = random.uniform(0.85, 1.15)
        try:
            self.exchange = self._bootstrap_exchange(start_index=0)
        except RuntimeError as exc:
            logger.error("Exchange bootstrap failed; activating mock mode: %s", exc)
            self._activate_mock_mode("bootstrap_failure")

        self.symbols = list(symbols or TOP_20_PAIRS)
        self.env = detect_host_environment()
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._db_path = DB_PATH
        self._ensure_schema()

        exchange_label = (
            self.exchange_priority[self._active_exchange_idx]
            if not self._mock_mode and self.exchange is not None
            else "mock"
        )
        logger.info(
            "DataHarvester initialized (env=%s, exchange=%s)",
            json.dumps(self.env),
            exchange_label,
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
        if self._mock_mode:
            logger.debug("Failover skipped; mock mode active")
            return
        if len(self.exchange_priority) == 1:
            logger.error("No fallback exchanges configured; enabling mock mode")
            self._activate_mock_mode("no_fallback")
            return
        try:
            next_index = (self._active_exchange_idx + 1) % len(self.exchange_priority)
            previous = self.exchange_priority[self._active_exchange_idx]
            self.exchange = self._bootstrap_exchange(start_index=next_index)
            logger.info("Failover: %s -> %s", previous, self.exchange_priority[self._active_exchange_idx])
        except RuntimeError as exc:
            logger.error("Failover exhausted exchanges; enabling mock mode: %s", exc)
            self._activate_mock_mode("exhausted")

    def _activate_mock_mode(self, reason: str) -> None:
        self._mock_mode = True
        self.exchange = None
        logger.warning("Mock market data mode engaged (%s)", reason)

    def _mock_price(self, symbol: str) -> float:
        base = 1_000 if symbol.endswith("/USDT") else 100
        wave = math.sin(time.time() / 60.0) * 50
        jitter = random.uniform(-5, 5)
        return max(1.0, base * self._mock_seed + wave + jitter)

    def _generate_mock_candles(self, symbol: str, days: int, timeframe: str) -> list[list[float]]:
        interval_ms = timeframe_to_ms(timeframe)
        periods = min(10_000, max(1, int(days * 24 * 60 * 60 * 1000 / interval_ms)))
        now_ms = int(time.time() * 1000)
        price = self._mock_price(symbol)
        rows: list[list[float]] = []
        for idx in range(periods):
            ts = now_ms - (periods - idx) * interval_ms
            drift = math.sin(idx / 30) * 25
            open_price = price + drift + random.uniform(-2, 2)
            close_price = open_price + random.uniform(-5, 5)
            high = max(open_price, close_price) + random.uniform(0, 3)
            low = min(open_price, close_price) - random.uniform(0, 3)
            volume = random.uniform(10, 200)
            rows.append([ts, open_price, high, low, close_price, volume])
        return rows

    def _ensure_schema(self) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(OHLCV_SCHEMA)
            conn.commit()

    def fetch_live_price(self, symbol: str) -> float:
        """Hit the public ticker endpoint for the latest trade price."""
        if self._mock_mode or self.exchange is None:
            return self._mock_price(symbol)
        for _ in range(len(self.exchange_priority)):
            try:
                ticker = self.exchange.fetch_ticker(symbol)
                return float(ticker["last"])
            except (ExchangeError, NetworkError, ExchangeNotAvailable) as exc:
                logger.warning(
                    "Live price fetch failed on %s: %s",
                    getattr(self.exchange, "id", "unknown"),
                    exc,
                )
                self._failover_exchange()
                if self._mock_mode:
                    break
        return self._mock_price(symbol)

    def backfill_history(self, symbol: str, days: int = 30, timeframe: str = "1m") -> int:
        """Pull >=10k candles (or requested days) and persist to SQLite."""
        if self._mock_mode or self.exchange is None:
            batch = self._generate_mock_candles(symbol, days=days, timeframe=timeframe)
            self._persist(symbol, batch)
            return len(batch)

        cutoff_ms = int(time.time() * 1000) - days * 24 * 60 * 60 * 1000
        since = cutoff_ms
        inserted = 0
        timeframe_ms = timeframe_to_ms(timeframe)

        while since < int(time.time() * 1000):
            try:
                batch = self.exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since, limit=1000)
            except (ExchangeError, NetworkError, ExchangeNotAvailable) as exc:
                logger.warning(
                    "Backfill failed on %s: %s",
                    getattr(self.exchange, "id", "unknown"),
                    exc,
                )
                self._failover_exchange()
                if self._mock_mode:
                    batch = self._generate_mock_candles(symbol, days=days, timeframe=timeframe)
                else:
                    continue

            if not batch:
                break
            self._persist(symbol, batch)
            inserted += len(batch)
            if len(batch) < 1000 or inserted >= 10_000:
                break
            since = batch[-1][0] + timeframe_ms

        if inserted == 0:
            batch = self._generate_mock_candles(symbol, days=days, timeframe=timeframe)
            self._persist(symbol, batch)
            inserted = len(batch)

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

    def load_or_generate(self, symbol: str, limit: int, timeframe: str = "1m") -> list[dict[str, Any]]:
        candles = self.load_ohlcv(symbol, limit)
        if candles:
            return candles
        days = max(1, limit // 1440)
        self.backfill_history(symbol, days=days, timeframe=timeframe)
        return self.load_ohlcv(symbol, limit)

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
                try:
                    price = await asyncio.to_thread(self.fetch_live_price, symbol)
                except Exception as exc:  # pragma: no cover - defensive
                    logger.error("Live price loop failed for %s: %s", symbol, exc)
                    continue
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
app.include_router(control_router)


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


def _normalize_symbol(symbol: str | None) -> str:
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    cleaned = symbol.replace(" ", "").upper()
    return cleaned


async def _load_ohlcv(symbol: str, limit: int) -> dict[str, Any]:
    normalized = _normalize_symbol(symbol)
    data = await asyncio.to_thread(harvester.load_or_generate, normalized, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No OHLCV data for {normalized}")
    return {"symbol": normalized, "candles": data}


@app.get("/api/ohlcv/batch")
async def get_ohlcv_batch(
    symbols: str = Query(..., description="Comma-delimited list of symbols (e.g., BTC/USDT,ETH/USDT)"),
    limit: int = Query(default=500, ge=50, le=2000),
) -> dict[str, Any]:
    requested = [item.strip() for item in symbols.split(",") if item.strip()]
    if not requested:
        raise HTTPException(status_code=400, detail="At least one symbol must be requested")
    if len(requested) > 8:
        raise HTTPException(status_code=400, detail="Batch requests are limited to 8 symbols")

    deduped = list(dict.fromkeys(requested))
    tasks = [asyncio.create_task(_load_ohlcv(symbol, limit)) for symbol in deduped]
    payloads = await asyncio.gather(*tasks, return_exceptions=True)

    candles: dict[str, Any] = {}
    for symbol, payload in zip(deduped, payloads):
        if isinstance(payload, Exception):
            if isinstance(payload, HTTPException) and payload.status_code == 404:
                candles[_normalize_symbol(symbol)] = []
                continue
            raise payload
        candles[payload["symbol"]] = payload["candles"]

    return {"symbols": list(candles.keys()), "candles": candles}


@app.get("/api/ohlcv/{symbol:path}")
async def get_ohlcv(symbol: str, limit: int = Query(default=500, ge=50, le=5000)) -> dict[str, Any]:
    return await _load_ohlcv(symbol, limit)


@app.get("/api/ohlcv")
async def get_ohlcv_query(symbol: str = Query(..., description="Pair such as BTC/USDT"), limit: int = Query(default=500, ge=50, le=5000)) -> dict[str, Any]:
    return await _load_ohlcv(symbol, limit)


@app.get("/api/health")
async def api_health() -> dict[str, Any]:
    exchange = None
    if not harvester._mock_mode and harvester.exchange is not None:
        exchange = getattr(harvester.exchange, "id", None)
    return {
        "status": "ok",
        "mode": "mock" if harvester._mock_mode else "live",
        "exchange": exchange,
        "symbols": harvester.symbols[:5],
    }


@app.get("/api/markets")
async def list_markets() -> dict[str, Any]:
    return {
        "count": len(harvester.symbols),
        "symbols": harvester.symbols,
        "flagship": harvester.symbols[:3],
    }
