"""Macro Intelligence — API Routes.

POST /api/v1/macro/analyze              — Full macro analysis
POST /api/v1/macro/portfolio-impact     — Macro overlay on portfolio
POST /api/v1/macro/underwriting-context — Macro overlay on underwriting
GET  /api/v1/macro/indicators           — List available indicators
GET  /api/v1/macro/diagnose             — Indicator diagnostics
GET  /api/v1/macro/regimes              — List all regime types
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.macro_intelligence.orchestrator.macro_orchestrator import get_orchestrator
from src.macro_intelligence.schemas.macro_schemas import (
    IndicatorsInput,
    RegimeType,
)
from src.macro_intelligence.ingestion.data_models import (
    GCC_BASELINE_INDICATORS,
    GCC_INDICATOR_METADATA,
)

router = APIRouter(prefix="/macro", tags=["macro-intelligence"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class PortfolioImpactRequest(BaseModel):
    """Request for macro → portfolio impact analysis."""
    indicators: IndicatorsInput = Field(
        default_factory=IndicatorsInput,
        description="Macro indicators (missing values use GCC baselines)",
    )
    portfolio_entities: list[str] | None = Field(
        default=None,
        description="Explicit entity list",
    )
    portfolio_id: str | None = Field(
        default=None,
        description="Preset portfolio name",
        json_schema_extra={"example": "gcc_energy"},
    )
    depth: int = Field(default=3, ge=1, le=5)


class UnderwritingContextRequest(BaseModel):
    """Request for macro → underwriting context."""
    indicators: IndicatorsInput = Field(
        default_factory=IndicatorsInput,
        description="Macro indicators",
    )
    entity_id: str = Field(
        ...,
        description="Target entity",
        json_schema_extra={"example": "hormuz"},
    )
    sector: str | None = Field(
        default=None,
        description="Business sector (auto-inferred if missing)",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    summary="Full macro analysis",
    description=(
        "Runs complete macro intelligence pipeline: "
        "indicator resolution → signal generation → regime classification "
        "→ sector mapping → risk overlay. "
        "Missing indicators default to GCC baselines."
    ),
)
async def post_macro_analyze(body: IndicatorsInput):
    """Analyze macroeconomic indicators."""
    orchestrator = get_orchestrator()
    context = orchestrator.analyze(body.to_indicator_dict())
    return context.to_dict()


@router.post(
    "/portfolio-impact",
    summary="Macro overlay on portfolio risk",
    description=(
        "Adjusts portfolio risk scores based on current macro regime "
        "and sector-specific impacts. Shows per-entity macro adjustments."
    ),
)
async def post_portfolio_impact(body: PortfolioImpactRequest):
    """Generate macro overlay for portfolio risk."""
    orchestrator = get_orchestrator()

    # Resolve portfolio entities
    entities = body.portfolio_entities
    if not entities and body.portfolio_id:
        from src.api.v1.portfolio import PRESETS
        entities = PRESETS.get(body.portfolio_id, [])

    if not entities:
        return {"error": "No portfolio entities provided or preset not found"}

    return orchestrator.portfolio_overlay(
        indicators_input=body.indicators.to_indicator_dict(),
        portfolio_entities=entities,
        depth=body.depth,
    )


@router.post(
    "/underwriting-context",
    summary="Macro overlay on underwriting",
    description=(
        "Adjusts entity risk score for underwriting decisions based on "
        "macro regime, sector impacts, and signal analysis."
    ),
)
async def post_underwriting_context(body: UnderwritingContextRequest):
    """Generate macro overlay for underwriting decisions."""
    orchestrator = get_orchestrator()
    return orchestrator.underwriting_overlay(
        indicators_input=body.indicators.to_indicator_dict(),
        entity_id=body.entity_id,
        sector=body.sector,
    )


@router.get(
    "/indicators",
    summary="List available indicators",
    description="Returns all GCC macro indicators with metadata, baselines, and thresholds.",
)
async def get_indicators():
    """List all available macro indicators."""
    return {
        "count": len(GCC_INDICATOR_METADATA),
        "baselines": GCC_BASELINE_INDICATORS,
        "indicators": {
            name: {
                "label": meta["label"],
                "label_ar": meta["label_ar"],
                "unit": meta["unit"],
                "baseline": meta["baseline"],
                "thresholds": {
                    "critical_low": meta.get("critical_low"),
                    "low": meta.get("low_threshold"),
                    "high": meta.get("high_threshold"),
                    "critical_high": meta.get("critical_high"),
                },
                "description": meta["description"],
            }
            for name, meta in GCC_INDICATOR_METADATA.items()
        },
    }


@router.post(
    "/diagnose",
    summary="Indicator diagnostics",
    description=(
        "Diagnostic view showing indicator states, deviations from baseline, "
        "z-scores, and critical alerts."
    ),
)
async def post_diagnose(body: IndicatorsInput):
    """Run indicator diagnostics."""
    orchestrator = get_orchestrator()
    return orchestrator.diagnose_indicators(body.to_indicator_dict())


@router.get(
    "/regimes",
    summary="List all regime types",
    description="Returns all macro regime classifications with descriptions.",
)
async def get_regimes():
    """List all regime types."""
    from src.macro_intelligence.regime.regime_detector import _REGIME_DESCRIPTIONS
    return {
        "regimes": [
            {
                "id": r.value,
                "description": _REGIME_DESCRIPTIONS[r]["en"],
                "description_ar": _REGIME_DESCRIPTIONS[r]["ar"],
            }
            for r in RegimeType
        ]
    }
