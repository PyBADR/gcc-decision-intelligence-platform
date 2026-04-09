"""Impact Observatory | مرصد الأثر — Risk Propagation API.

GET /api/v1/risk/propagation/{entity_id}  — Multi-hop risk propagation analysis
GET /api/v1/risk/propagation              — List available root entities

All graph access via GraphRepository (Single Source of Truth).
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.graph_brain.decision.risk_propagation_service import analyze_propagation
from src.graph_brain.storage import get_repository

router = APIRouter(prefix="/risk", tags=["risk-propagation"])


@router.get(
    "/propagation/{entity_id}",
    summary="Analyze risk propagation from a root entity",
    description=(
        "Performs multi-hop BFS traversal from the specified entity, "
        "computing propagated risk scores with hop decay and edge weights. "
        "Returns impacted nodes, critical paths, sector breakdown, and audit hash."
    ),
)
async def get_risk_propagation(
    entity_id: str,
    depth: int = Query(default=3, ge=1, le=5, description="Max traversal depth (1–5)"),
    min_risk: float = Query(default=0.01, ge=0.0, le=1.0, description="Min risk threshold"),
    max_nodes: int = Query(default=50, ge=1, le=200, description="Max impacted nodes"),
):
    """Analyze risk propagation from a root entity through the GCC knowledge graph."""
    return analyze_propagation(
        entity_id=entity_id,
        depth=depth,
        min_risk_threshold=min_risk,
        max_nodes=max_nodes,
    )


@router.get(
    "/propagation",
    summary="List available entities for propagation analysis",
    description="Returns all entities in the knowledge graph that can serve as propagation roots.",
)
async def list_propagation_entities(
    layer: str | None = Query(default=None, description="Filter by layer (infrastructure, economy, finance, geography, society)"),
):
    """List entities available for risk propagation analysis."""
    repo = get_repository()
    all_nodes = repo.get_all_nodes()

    if layer:
        all_nodes = [n for n in all_nodes if n.type == layer]

    return {
        "count": len(all_nodes),
        "entities": [
            {
                "id": n.id,
                "label": n.properties.get("label", n.id),
                "label_ar": n.properties.get("label_ar", ""),
                "layer": n.type,
            }
            for n in all_nodes
        ],
    }
