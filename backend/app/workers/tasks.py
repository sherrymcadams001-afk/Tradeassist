"""Celery task definitions for VERIDIAN."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "veridian",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)


@celery_app.task(name="orders.place")
def submit_order(order_payload: dict, venue: str) -> dict:
    """Placeholder task to demonstrate background order execution."""
    # Real implementation would hydrate OrderRequest and call OrderRouter.
    return {"status": "queued", "venue": venue, "payload": order_payload}
