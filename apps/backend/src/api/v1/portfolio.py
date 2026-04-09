"""Impact Observatory | مرصد الأثر — Portfolio Risk API.

POST /api/v1/portfolio/risk  — Analyze portfolio-level risk
GET  /api/v1/portfolio/risk/preset/{name}  — Pre-built portfolio presets
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.graph_brain.decision.portfolio_risk_service import analyze_portfolio_risk

router = APIRouter(prefix="/portfolio", tags=["portfolio-risk"])


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class PortfolioRiskRequest(BaseModel):
    """Request body for portfolio risk analysis."""
    entities: list[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of entity IDs to analyze as a portfolio",
        json_schema_extra={"example": ["hormuz", "oil_sector", "insurance", "sama"]},
    )
    depth: int = Field(default=3, ge=1, le=5, description="BFS depth per entity")


# ---------------------------------------------------------------------------
# Pre-built portfolio presets
# ---------------------------------------------------------------------------

PRESETS: dict[str, list[str]] = {
    "gcc_critical_infra": [
        "hormuz", "shipping", "power_grid", "aramco_infra",
        "jebel_ali", "ras_tanura",
    ],
    "gcc_finance": [
        "sama", "cbuae", "cbk", "fin_markets", "insurance", "reinsurance",
    ],
    "gcc_energy": [
        "oil_sector", "gas_sector", "aramco_infra", "ras_tanura", "hormuz",
    ],
    "gcc_trade": [
        "hormuz", "shipping", "jebel_ali", "logistics", "supply_chain",
        "shipping_sector",
    ],
    "gcc_diversified": [
        "hormuz", "oil_sector", "sama", "insurance", "logistics",
        "dubai_apt", "power_grid",
    ],
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/risk",
    summary="Analyze portfolio-level risk",
    description=(
        "Runs risk propagation for each entity, then aggregates into "
        "portfolio-level metrics: total risk, sector exposure, "
        "concentration risk, systemic hotspots, and critical dependencies."
    ),
)
async def post_portfolio_risk(body: PortfolioRiskRequest):
    """Analyze portfolio-level risk across multiple entities."""
    return analyze_portfolio_risk(
        portfolio_entities=body.entities,
        depth=body.depth,
    )


@router.get(
    "/risk/preset/{name}",
    summary="Run pre-built portfolio preset",
    description="Analyze a pre-configured portfolio. Available: " + ", ".join(PRESETS.keys()),
)
async def get_portfolio_preset(
    name: str,
    depth: int = Query(default=3, ge=1, le=5),
):
    """Run a pre-built portfolio analysis."""
    entities = PRESETS.get(name)
    if not entities:
        return {
            "error": f"Unknown preset '{name}'",
            "available": list(PRESETS.keys()),
        }
    return analyze_portfolio_risk(
        portfolio_entities=entities,
        depth=depth,
    )


@router.get(
    "/risk/presets",
    summary="List available portfolio presets",
)
async def list_presets():
    """List all available pre-built portfolio presets."""
    return {
        "presets": {
            name: {"entity_count": len(entities), "entities": entities}
            for name, entities in PRESETS.items()
        }
    }
