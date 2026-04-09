"""Impact Observatory | مرصد الأثر — Portfolio Risk Service.

Orchestration layer over the Portfolio Risk Engine.
Enriches results with entity metadata from GraphRepository.
"""

from __future__ import annotations

from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository
from src.graph_brain.decision.portfolio_risk_engine import (
    analyze_portfolio,
    PortfolioRiskResult,
)
from src.risk_models import _infer_sector, classify_risk


def analyze_portfolio_risk(
    portfolio_entities: list[str],
    depth: int = 3,
    repo: GraphRepository | None = None,
) -> dict[str, Any]:
    """Analyze portfolio-level risk with enriched metadata.

    Args:
        portfolio_entities: List of entity IDs.
        depth: BFS depth per entity.
        repo: Optional GraphRepository override.

    Returns:
        Enriched PortfolioRiskResult as dict.
    """
    if repo is None:
        repo = get_repository()

    result: PortfolioRiskResult = analyze_portfolio(
        portfolio_entities=portfolio_entities,
        depth=depth,
        repo=repo,
    )

    # ── Enrich entity risks with metadata ───────────────────────────────
    enriched_entities: list[dict[str, Any]] = []
    for er in result.entity_risks:
        node = repo.get_node(er.entity_id)
        risk_level = classify_risk(
            min(er.total_system_risk / max(er.impacted_count, 1), 1.0)
        )
        enriched_entities.append({
            **er.to_dict(),
            "label": node.properties.get("label", er.entity_id) if node else er.entity_id,
            "label_ar": node.properties.get("label_ar", "") if node else "",
            "layer": node.type if node else "unknown",
            "risk_level": risk_level,
            "found": node is not None,
        })

    # ── Enrich systemic hotspots ────────────────────────────────────────
    enriched_hotspots: list[dict[str, Any]] = []
    for hid in result.systemic_hotspots:
        node = repo.get_node(hid)
        enriched_hotspots.append({
            "id": hid,
            "label": node.properties.get("label", hid) if node else hid,
            "label_ar": node.properties.get("label_ar", "") if node else "",
            "sector": _infer_sector(hid),
            "layer": node.type if node else "unknown",
        })

    # ── Portfolio health classification ─────────────────────────────────
    avg = result.average_risk_score
    if avg > 8.0:
        health = "CRITICAL"
    elif avg > 5.0:
        health = "HIGH"
    elif avg > 3.0:
        health = "ELEVATED"
    elif avg > 1.5:
        health = "GUARDED"
    else:
        health = "NOMINAL"

    # ── Concentration assessment ────────────────────────────────────────
    if result.concentration_risk > 0.7:
        concentration_label = "SEVERE — single entity dominates portfolio risk"
    elif result.concentration_risk > 0.4:
        concentration_label = "HIGH — risk concentrated in few entities"
    elif result.concentration_risk > 0.2:
        concentration_label = "MODERATE — some concentration detected"
    else:
        concentration_label = "LOW — risk well distributed"

    return {
        "portfolio_entities": result.portfolio_entities,
        "entity_count": len(result.portfolio_entities),
        "total_risk_score": round(result.total_risk_score, 6),
        "average_risk_score": round(result.average_risk_score, 6),
        "max_risk_entity": result.max_risk_entity,
        "max_risk_score": round(result.max_risk_score, 6),
        "portfolio_health": health,
        "entity_risks": enriched_entities,
        "sector_exposure": [s.to_dict() for s in result.sector_exposure],
        "concentration": {
            "score": round(result.concentration_risk, 6),
            "hhi_index": round(result.hhi_index, 6),
            "label": concentration_label,
        },
        "systemic_hotspots": enriched_hotspots,
        "critical_dependencies": result.critical_dependencies,
        "audit_hash": result.audit_hash,
        "parameters": {
            "depth": depth,
        },
    }
