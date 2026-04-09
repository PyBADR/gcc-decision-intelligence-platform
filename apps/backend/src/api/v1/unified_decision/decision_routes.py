"""Unified Decision API — Single Brain Endpoint.

POST /api/v1/decision/evaluate      — Full unified decision (single entity)
POST /api/v1/decision/batch         — Batch evaluation under shared macro
GET  /api/v1/decision/quick/{id}    — Quick evaluation with defaults
GET  /api/v1/decision/capabilities  — List what the brain can do
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from src.api.v1.unified_decision.schemas import (
    UnifiedDecisionRequest,
    BatchDecisionRequest,
)
from src.api.v1.unified_decision.decision_service import (
    evaluate_unified,
    evaluate_batch,
)

router = APIRouter(prefix="/decision", tags=["unified-decision"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/evaluate",
    summary="Unified Decision — Single Brain Endpoint",
    description=(
        "The complete Decision Intelligence pipeline in one call.\n\n"
        "Aggregates **all 4 intelligence layers** into a single response:\n"
        "- **Macro Intelligence**: regime classification, signals, sector impacts\n"
        "- **Graph Intelligence**: risk propagation, critical paths, dependencies\n"
        "- **Portfolio Risk**: exposure, concentration, systemic hotspots\n"
        "- **Underwriting Decision**: pricing, coverage, conditions\n\n"
        "Returns a unified decision with full explainability chain and audit trail.\n\n"
        "Missing macro indicators default to GCC baselines. "
        "Sector is auto-inferred if not provided."
    ),
)
async def post_evaluate(body: UnifiedDecisionRequest):
    """Run the full unified decision pipeline."""
    return evaluate_unified(
        entity_id=body.entity_id,
        sector=body.sector,
        portfolio_id=body.portfolio_id,
        portfolio_entities=body.portfolio_entities,
        requested_coverage=body.requested_coverage,
        indicators_input=body.indicators.to_indicator_dict(),
        historical_signals=body.historical_signals,
        depth=body.depth,
        include_graph_detail=body.include_graph_detail,
        include_macro_signals=body.include_macro_signals,
    )


@router.post(
    "/batch",
    summary="Batch unified evaluation",
    description=(
        "Evaluate multiple entities under the same macro context. "
        "Returns individual decisions plus aggregate summary."
    ),
)
async def post_batch(body: BatchDecisionRequest):
    """Batch evaluation under shared macro context."""
    return evaluate_batch(
        entities=body.entities,
        indicators_input=body.indicators.to_indicator_dict(),
        portfolio_id=body.portfolio_id,
        depth=body.depth,
    )


@router.get(
    "/quick/{entity_id}",
    summary="Quick unified evaluation",
    description=(
        "Quick evaluation with default macro indicators and auto-inferred sector. "
        "Lighter than full evaluate — suitable for dashboards."
    ),
)
async def get_quick(
    entity_id: str,
    coverage: float = Query(default=1_000_000.0, gt=0),
    portfolio: str | None = Query(default=None),
    depth: int = Query(default=3, ge=1, le=5),
    oil: float | None = Query(default=None, description="Brent crude USD/bbl"),
    inflation: float | None = Query(default=None, description="CPI rate"),
    rates: float | None = Query(default=None, description="Policy rate"),
):
    """Quick unified evaluation with query-param indicators."""
    indicators: dict[str, float] = {}
    if oil is not None:
        indicators["brent_crude"] = oil
    if inflation is not None:
        indicators["inflation"] = inflation
    if rates is not None:
        indicators["interest_rate"] = rates

    return evaluate_unified(
        entity_id=entity_id,
        requested_coverage=coverage,
        portfolio_id=portfolio,
        indicators_input=indicators,
        depth=depth,
        include_graph_detail=True,
        include_macro_signals=False,  # Lighter for quick
    )


@router.get(
    "/capabilities",
    summary="Decision brain capabilities",
    description="Describes what the unified decision engine can do.",
)
async def get_capabilities():
    """List the capabilities of the unified decision brain."""
    from src.macro_intelligence.signals.indicators import SIGNAL_RULES
    from src.macro_intelligence.ingestion.data_models import GCC_INDICATOR_METADATA
    from src.api.v1.portfolio import PRESETS
    from src.graph_brain.storage import get_repository

    repo = get_repository()
    all_nodes = repo.get_all_nodes()

    return {
        "service": "Impact Observatory — Unified Decision Brain",
        "version": "2.1.0",
        "layers": {
            "macro_intelligence": {
                "indicators": len(GCC_INDICATOR_METADATA),
                "signal_rules": len(SIGNAL_RULES),
                "regime_types": 7,
                "description": "Macro regime detection, signal generation, sector mapping",
            },
            "graph_intelligence": {
                "total_nodes": len(all_nodes),
                "layers": list({n.type for n in all_nodes}),
                "description": "BFS risk propagation with hop decay and edge weights",
            },
            "portfolio_risk": {
                "presets": list(PRESETS.keys()),
                "description": "Multi-entity risk aggregation, concentration analysis, HHI",
            },
            "underwriting": {
                "decision_types": ["APPROVED", "CONDITIONAL", "REJECTED"],
                "pricing_tiers": 6,
                "description": "Risk-based pricing, coverage limits, conditional constraints",
            },
        },
        "endpoints": {
            "POST /api/v1/decision/evaluate": "Full unified decision",
            "POST /api/v1/decision/batch": "Batch evaluation",
            "GET /api/v1/decision/quick/{entity_id}": "Quick evaluation",
            "GET /api/v1/decision/capabilities": "This endpoint",
        },
        "entities_available": [
            {"id": n.id, "label": n.properties.get("label", n.id), "layer": n.type}
            for n in sorted(all_nodes, key=lambda n: n.id)
        ],
    }
