"""Impact Observatory | مرصد الأثر — Risk Propagation Service.

Orchestration layer over the propagation engine.
Enriches raw propagation results with node metadata, sector labels,
risk classifications, and human-readable descriptions.

Uses GraphRepository for all data access (Single Source of Truth).
"""

from __future__ import annotations

from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository
from src.graph_brain.decision.risk_propagation_engine import (
    propagate_risk,
    PropagationResult,
)
from src.risk_models import _infer_sector, classify_risk


def analyze_propagation(
    entity_id: str,
    depth: int = 3,
    min_risk_threshold: float = 0.01,
    max_nodes: int = 50,
    repo: GraphRepository | None = None,
) -> dict[str, Any]:
    """Analyze risk propagation from a root entity.

    Calls propagate_risk() then enriches each impacted node with:
    - label, label_ar (from graph repository)
    - sector (inferred)
    - layer (from graph repository)
    - risk_level classification (from URS thresholds)

    Args:
        entity_id: Root node ID.
        depth: Max traversal depth (1–5).
        min_risk_threshold: Filter out nodes below this score.
        max_nodes: Max impacted nodes to return.
        repo: Optional GraphRepository override.

    Returns:
        Enriched PropagationResult as dict, ready for API serialization.
    """
    if repo is None:
        repo = get_repository()

    result: PropagationResult = propagate_risk(
        entity_id=entity_id,
        depth=depth,
        min_risk_threshold=min_risk_threshold,
        max_nodes=max_nodes,
        repo=repo,
    )

    # ── Enrich root entity ──────────────────────────────────────────────
    root_node = repo.get_node(entity_id)
    root_info: dict[str, Any] = {
        "id": entity_id,
        "label": root_node.properties.get("label", entity_id) if root_node else entity_id,
        "label_ar": root_node.properties.get("label_ar", "") if root_node else "",
        "layer": root_node.type if root_node else "unknown",
        "sector": _infer_sector(entity_id),
        "found": root_node is not None,
    }

    # ── Enrich impacted nodes ───────────────────────────────────────────
    enriched_nodes: list[dict[str, Any]] = []
    sector_breakdown: dict[str, float] = {}

    for nr in result.impacted_nodes:
        node = repo.get_node(nr.node_id)
        sector = _infer_sector(nr.node_id)
        risk_level = classify_risk(nr.total_risk)

        enriched: dict[str, Any] = {
            **nr.to_dict(),
            "label": node.properties.get("label", nr.node_id) if node else nr.node_id,
            "label_ar": node.properties.get("label_ar", "") if node else "",
            "layer": node.type if node else "unknown",
            "sector": sector,
            "risk_level": risk_level,
        }
        enriched_nodes.append(enriched)
        sector_breakdown[sector] = sector_breakdown.get(sector, 0.0) + nr.total_risk

    # Sort sector breakdown by risk
    sector_summary = [
        {"sector": k, "total_risk": round(v, 6)}
        for k, v in sorted(sector_breakdown.items(), key=lambda x: -x[1])
    ]

    # ── Enrich critical paths with labels ───────────────────────────────
    labeled_paths: list[list[dict[str, str]]] = []
    for path in result.critical_paths:
        labeled_path: list[dict[str, str]] = []
        for nid in path:
            nd = repo.get_node(nid)
            labeled_path.append({
                "id": nid,
                "label": nd.properties.get("label", nid) if nd else nid,
            })
        labeled_paths.append(labeled_path)

    # ── System risk classification ──────────────────────────────────────
    system_risk_level = classify_risk(
        min(result.total_system_risk / max(len(enriched_nodes), 1), 1.0)
    )

    return {
        "root_entity": root_info,
        "impacted_nodes": enriched_nodes,
        "impacted_count": len(enriched_nodes),
        "total_system_risk": round(result.total_system_risk, 6),
        "max_chain": round(result.max_chain, 6),
        "system_risk_level": system_risk_level,
        "critical_paths": result.critical_paths,
        "critical_paths_labeled": labeled_paths,
        "sector_breakdown": sector_summary,
        "audit_hash": result.audit_hash,
        "parameters": {
            "depth": depth,
            "min_risk_threshold": min_risk_threshold,
            "max_nodes": max_nodes,
        },
    }
