"""Impact Observatory | مرصد الأثر — Signal Ingestion API.

POST /ingest/signal  — Ingest a macro intelligence signal into the KG.
GET  /ingest/health  — Check ingestion pipeline health.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from src.schemas.macro_signal import MacroSignal, IngestResult
from src.services.signal_ingestion_service import ingest_signal

logger = logging.getLogger("observatory.api.ingest")

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post(
    "/signal",
    response_model=IngestResult,
    summary="Ingest a macro intelligence signal",
    description=(
        "Validates the signal against the MacroSignal schema, "
        "checks confidence tier (quarantine if < 0.30), "
        "then writes Signal + Event nodes to Neo4j with a [:TRIGGERS] relationship."
    ),
)
async def post_ingest_signal(signal: MacroSignal) -> IngestResult:
    """Ingest a single macro signal into the Knowledge Graph."""
    try:
        result = await ingest_signal(signal)
        logger.info(
            "Ingested signal=%s event=%s tier=%s neo4j=%s",
            result.signal_id, result.event_id,
            result.confidence_tier.value, result.neo4j_written,
        )
        return result
    except RuntimeError as exc:
        # Neo4j not initialized
        if "Neo4j driver not initialized" in str(exc):
            raise HTTPException(
                status_code=503,
                detail="Neo4j is not connected. Start Neo4j and restart the server.",
            )
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Ingestion failed for signal %s", signal.id)
        raise HTTPException(status_code=500, detail=f"Ingestion error: {exc}")


@router.get("/health", summary="Ingestion pipeline health check")
async def ingest_health():
    """Check if the ingestion pipeline is ready (Neo4j reachable)."""
    try:
        from src.db.neo4j import get_neo4j_session
        async with get_neo4j_session() as session:
            result = await session.run("RETURN 1 AS ok")
            record = await result.single()
            return {
                "status": "healthy",
                "neo4j": "connected",
                "ready": record["ok"] == 1,
            }
    except RuntimeError:
        return {
            "status": "degraded",
            "neo4j": "not_initialized",
            "ready": False,
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "neo4j": "error",
            "detail": str(exc),
            "ready": False,
        }
