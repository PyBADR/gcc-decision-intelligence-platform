"""Impact Observatory | مرصد الأثر — Underwriting Intelligence API.

POST /api/v1/underwriting/evaluate       — Single entity underwriting
POST /api/v1/underwriting/batch          — Batch underwriting evaluation
GET  /api/v1/underwriting/quick/{entity}  — Quick evaluation with defaults
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Any, Optional

from src.graph_brain.decision.underwriting_service import (
    run_underwriting,
    run_batch_underwriting,
)

router = APIRouter(prefix="/underwriting", tags=["underwriting"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class UnderwritingRequest(BaseModel):
    """Request body for underwriting evaluation."""
    entity_id: str = Field(
        ...,
        description="Entity ID in the knowledge graph",
        json_schema_extra={"example": "hormuz"},
    )
    portfolio_id: str | None = Field(
        default=None,
        description="Preset portfolio name (gcc_critical_infra, gcc_finance, etc.)",
        json_schema_extra={"example": "gcc_energy"},
    )
    portfolio_entities: list[str] | None = Field(
        default=None,
        description="Explicit portfolio entity list (overrides portfolio_id)",
    )
    sector: str | None = Field(
        default=None,
        description="Business sector (auto-inferred if not provided)",
        json_schema_extra={"example": "energy"},
    )
    requested_coverage: float = Field(
        default=1_000_000.0,
        gt=0,
        description="Requested coverage amount",
        json_schema_extra={"example": 5_000_000},
    )
    historical_signals: list[dict[str, Any]] | None = Field(
        default=None,
        description="Historical signal data for risk adjustment",
    )
    depth: int = Field(
        default=3,
        ge=1,
        le=5,
        description="BFS propagation depth",
    )


class BatchUnderwritingRequest(BaseModel):
    """Request body for batch underwriting evaluation."""
    entities: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of entity evaluation requests",
        json_schema_extra={"example": [
            {"entity_id": "hormuz", "sector": "maritime", "requested_coverage": 10_000_000},
            {"entity_id": "sama", "sector": "banking", "requested_coverage": 5_000_000},
            {"entity_id": "insurance", "sector": "insurance", "requested_coverage": 3_000_000},
        ]},
    )
    depth: int = Field(
        default=3,
        ge=1,
        le=5,
        description="BFS propagation depth for all entities",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/evaluate",
    summary="Evaluate underwriting decision",
    description=(
        "Runs full underwriting analysis: entity risk propagation, "
        "portfolio context, risk scoring fusion, decision logic, "
        "pricing adjustment, and condition generation. "
        "Returns actionable decision with explainable reasoning."
    ),
)
async def post_underwriting_evaluate(body: UnderwritingRequest):
    """Evaluate underwriting decision for a single entity."""
    return run_underwriting(
        entity_id=body.entity_id,
        sector=body.sector,
        requested_coverage=body.requested_coverage,
        portfolio_id=body.portfolio_id,
        portfolio_entities=body.portfolio_entities,
        historical_signals=body.historical_signals,
        depth=body.depth,
    )


@router.post(
    "/batch",
    summary="Batch underwriting evaluation",
    description=(
        "Evaluates multiple entities in a single request. "
        "Returns individual decisions plus aggregate summary "
        "(approval rate, total coverage, etc.)."
    ),
)
async def post_underwriting_batch(body: BatchUnderwritingRequest):
    """Batch underwriting evaluation for multiple entities."""
    return run_batch_underwriting(
        entities=body.entities,
        depth=body.depth,
    )


@router.get(
    "/quick/{entity_id}",
    summary="Quick underwriting evaluation",
    description="Quick evaluation with default parameters. Sector is auto-inferred.",
)
async def get_quick_underwriting(
    entity_id: str,
    coverage: float = Query(default=1_000_000.0, gt=0, description="Requested coverage"),
    portfolio: str | None = Query(default=None, description="Preset portfolio name"),
    depth: int = Query(default=3, ge=1, le=5, description="BFS depth"),
):
    """Quick underwriting evaluation with defaults."""
    return run_underwriting(
        entity_id=entity_id,
        requested_coverage=coverage,
        portfolio_id=portfolio,
        depth=depth,
    )
