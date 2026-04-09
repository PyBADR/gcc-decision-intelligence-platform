"""Impact Observatory | مرصد الأثر — Portfolio Risk Engine.

Aggregates systemic risk across multiple entities and transforms
graph-level risk into portfolio-level intelligence.

Pipeline:
    Entity-level propagated risk
    → Portfolio aggregation
    → Sector exposure
    → Systemic overlap detection
    → Concentration risk
    → Business decision insights

Uses GraphRepository and RiskPropagationEngine — no direct data access.
Deterministic. Includes audit hash.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository
from src.graph_brain.decision.risk_propagation_engine import (
    propagate_risk,
    PropagationResult,
    NodeRisk,
)
from src.risk_models import _infer_sector


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class EntityRiskSummary:
    """Risk summary for a single entity in the portfolio."""
    entity_id: str
    total_system_risk: float
    impacted_count: int
    max_chain: float
    sector: str
    critical_paths: list[list[str]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "total_system_risk": round(self.total_system_risk, 6),
            "impacted_count": self.impacted_count,
            "max_chain": round(self.max_chain, 6),
            "sector": self.sector,
            "critical_paths": self.critical_paths,
        }


@dataclass
class SectorExposure:
    """Risk exposure for a single sector."""
    sector: str
    total_risk: float
    entity_count: int
    contribution_pct: float  # % of total portfolio risk
    entities: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "sector": self.sector,
            "total_risk": round(self.total_risk, 6),
            "entity_count": self.entity_count,
            "contribution_pct": round(self.contribution_pct, 2),
            "entities": self.entities,
        }


@dataclass
class PortfolioRiskResult:
    """Complete portfolio risk analysis."""
    portfolio_entities: list[str]
    total_risk_score: float
    average_risk_score: float
    max_risk_entity: str
    max_risk_score: float
    entity_risks: list[EntityRiskSummary]
    sector_exposure: list[SectorExposure]
    concentration_risk: float  # 0–1, how concentrated risk is
    systemic_hotspots: list[str]  # shared upstream nodes
    critical_dependencies: list[list[str]]  # dependency chains
    hhi_index: float  # Herfindahl-Hirschman Index for concentration
    audit_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "portfolio_entities": self.portfolio_entities,
            "total_risk_score": round(self.total_risk_score, 6),
            "average_risk_score": round(self.average_risk_score, 6),
            "max_risk_entity": self.max_risk_entity,
            "max_risk_score": round(self.max_risk_score, 6),
            "entity_risks": [e.to_dict() for e in self.entity_risks],
            "sector_exposure": [s.to_dict() for s in self.sector_exposure],
            "concentration_risk": round(self.concentration_risk, 6),
            "systemic_hotspots": self.systemic_hotspots,
            "critical_dependencies": self.critical_dependencies,
            "hhi_index": round(self.hhi_index, 6),
            "audit_hash": self.audit_hash,
        }


# ---------------------------------------------------------------------------
# Core engine
# ---------------------------------------------------------------------------

def analyze_portfolio(
    portfolio_entities: list[str],
    depth: int = 3,
    repo: GraphRepository | None = None,
) -> PortfolioRiskResult:
    """Analyze portfolio-level risk across multiple entities.

    Args:
        portfolio_entities: List of entity IDs in the portfolio.
        depth: BFS traversal depth for each entity's propagation.
        repo: Optional GraphRepository override.

    Returns:
        PortfolioRiskResult with aggregated risk, sector exposure,
        systemic hotspots, and concentration metrics.
    """
    if repo is None:
        repo = get_repository()

    if not portfolio_entities:
        return _empty_result()

    # ── Step 1: Per-entity propagation ──────────────────────────────────
    entity_results: dict[str, PropagationResult] = {}
    entity_summaries: list[EntityRiskSummary] = []

    for eid in portfolio_entities:
        result = propagate_risk(
            entity_id=eid,
            depth=depth,
            min_risk_threshold=0.01,
            max_nodes=50,
            repo=repo,
        )
        entity_results[eid] = result
        entity_summaries.append(EntityRiskSummary(
            entity_id=eid,
            total_system_risk=result.total_system_risk,
            impacted_count=len(result.impacted_nodes),
            max_chain=result.max_chain,
            sector=_infer_sector(eid),
            critical_paths=result.critical_paths,
        ))

    # Sort by risk descending
    entity_summaries.sort(key=lambda e: -e.total_system_risk)

    # ── Step 2: Aggregate metrics ───────────────────────────────────────
    risks = [s.total_system_risk for s in entity_summaries]
    total_risk = sum(risks)
    avg_risk = total_risk / len(risks) if risks else 0.0
    max_entity = entity_summaries[0] if entity_summaries else None
    max_risk_entity = max_entity.entity_id if max_entity else ""
    max_risk_score = max_entity.total_system_risk if max_entity else 0.0

    # ── Step 3: Sector analysis ─────────────────────────────────────────
    sector_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"risk": 0.0, "count": 0, "entities": []}
    )
    for s in entity_summaries:
        sector_data[s.sector]["risk"] += s.total_system_risk
        sector_data[s.sector]["count"] += 1
        sector_data[s.sector]["entities"].append(s.entity_id)

    sector_exposures: list[SectorExposure] = []
    for sector, data in sorted(sector_data.items(), key=lambda x: -x[1]["risk"]):
        pct = (data["risk"] / total_risk * 100) if total_risk > 0 else 0
        sector_exposures.append(SectorExposure(
            sector=sector,
            total_risk=data["risk"],
            entity_count=data["count"],
            contribution_pct=pct,
            entities=data["entities"],
        ))

    # ── Step 4: Systemic overlap detection ──────────────────────────────
    # Count how many portfolio entities impact the same downstream node
    node_impact_count: dict[str, int] = defaultdict(int)
    node_impact_sources: dict[str, list[str]] = defaultdict(list)

    for eid, result in entity_results.items():
        for nr in result.impacted_nodes:
            node_impact_count[nr.node_id] += 1
            node_impact_sources[nr.node_id].append(eid)

    # Hotspots = nodes impacted by 2+ portfolio entities
    hotspots: list[tuple[str, int]] = [
        (nid, count)
        for nid, count in node_impact_count.items()
        if count >= 2 and nid not in portfolio_entities
    ]
    hotspots.sort(key=lambda x: -x[1])
    systemic_hotspots = [nid for nid, _ in hotspots[:10]]

    # Critical dependencies = paths that multiple entities share
    critical_deps: list[list[str]] = []
    for hotspot_id in systemic_hotspots[:5]:
        sources = node_impact_sources[hotspot_id]
        critical_deps.append(sources + [hotspot_id])

    # ── Step 5: Concentration risk ──────────────────────────────────────
    # Herfindahl-Hirschman Index (HHI) on risk shares
    if total_risk > 0:
        shares = [(r / total_risk) for r in risks]
        hhi = sum(s ** 2 for s in shares)
    else:
        hhi = 0.0

    # Concentration risk = how much the top entity dominates
    # 0 = evenly distributed, 1 = single entity dominates
    if total_risk > 0 and len(risks) > 1:
        top_share = max_risk_score / total_risk
        # Normalize: if N entities, perfect distribution = 1/N
        # concentration = (actual_top_share - 1/N) / (1 - 1/N)
        n = len(risks)
        even_share = 1.0 / n
        concentration = min((top_share - even_share) / (1.0 - even_share), 1.0)
        concentration = max(concentration, 0.0)
    else:
        concentration = 1.0 if risks else 0.0

    # ── Audit hash ──────────────────────────────────────────────────────
    audit_hash = _compute_audit_hash(portfolio_entities, total_risk, max_risk_entity)

    return PortfolioRiskResult(
        portfolio_entities=portfolio_entities,
        total_risk_score=total_risk,
        average_risk_score=avg_risk,
        max_risk_entity=max_risk_entity,
        max_risk_score=max_risk_score,
        entity_risks=entity_summaries,
        sector_exposure=sector_exposures,
        concentration_risk=concentration,
        systemic_hotspots=systemic_hotspots,
        critical_dependencies=critical_deps,
        hhi_index=hhi,
        audit_hash=audit_hash,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_result() -> PortfolioRiskResult:
    return PortfolioRiskResult(
        portfolio_entities=[],
        total_risk_score=0.0,
        average_risk_score=0.0,
        max_risk_entity="",
        max_risk_score=0.0,
        entity_risks=[],
        sector_exposure=[],
        concentration_risk=0.0,
        systemic_hotspots=[],
        critical_dependencies=[],
        hhi_index=0.0,
        audit_hash=_compute_audit_hash([], 0.0, ""),
    )


def _compute_audit_hash(
    entities: list[str], total_risk: float, max_entity: str
) -> str:
    payload = json.dumps({
        "portfolio_entities": sorted(entities),
        "total_risk_score": round(total_risk, 6),
        "max_risk_entity": max_entity,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
