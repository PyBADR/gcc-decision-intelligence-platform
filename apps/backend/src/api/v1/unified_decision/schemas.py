"""Unified Decision API — Request/Response Schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from src.macro_intelligence.schemas.macro_schemas import IndicatorsInput


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class UnifiedDecisionRequest(BaseModel):
    """Single request that drives the entire decision pipeline."""

    entity_id: str = Field(
        ...,
        description="Target entity in the knowledge graph",
        json_schema_extra={"example": "hormuz"},
    )
    sector: str | None = Field(
        default=None,
        description="Business sector (auto-inferred if omitted)",
        json_schema_extra={"example": "maritime"},
    )
    portfolio_id: str | None = Field(
        default=None,
        description="Preset portfolio name",
        json_schema_extra={"example": "gcc_energy"},
    )
    portfolio_entities: list[str] | None = Field(
        default=None,
        description="Explicit portfolio entity list (overrides portfolio_id)",
    )
    requested_coverage: float = Field(
        default=1_000_000.0,
        gt=0,
        description="Requested coverage amount",
        json_schema_extra={"example": 5_000_000},
    )
    indicators: IndicatorsInput = Field(
        default_factory=IndicatorsInput,
        description="Macro indicators (missing values use GCC baselines)",
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
    include_graph_detail: bool = Field(
        default=True,
        description="Include full graph neighborhood detail",
    )
    include_macro_signals: bool = Field(
        default=True,
        description="Include individual macro signal breakdowns",
    )


class BatchDecisionRequest(BaseModel):
    """Batch evaluation of multiple entities under same macro context."""

    entities: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of entity evaluation configs",
        json_schema_extra={"example": [
            {"entity_id": "hormuz", "sector": "maritime", "requested_coverage": 10_000_000},
            {"entity_id": "sama", "sector": "banking", "requested_coverage": 5_000_000},
        ]},
    )
    indicators: IndicatorsInput = Field(
        default_factory=IndicatorsInput,
        description="Shared macro indicators for all entities",
    )
    portfolio_id: str | None = Field(
        default=None,
        description="Shared portfolio context",
    )
    depth: int = Field(default=3, ge=1, le=5)
