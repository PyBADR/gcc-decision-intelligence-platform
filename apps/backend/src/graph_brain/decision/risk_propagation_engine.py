"""Impact Observatory | مرصد الأثر — Risk Propagation Engine.

Extends the decision intelligence pipeline from:
    Entity → Risk Score
To:
    Entity → Risk → Propagation → Systemic Impact

Uses GraphRepository for all graph access (Single Source of Truth).
Uses existing risk_models for URS-based base scoring.
Does NOT modify RiskEngine or duplicate BFS logic.

Propagation formula per visited node:
    propagated_score = base_score × hop_decay × edge_weight

Deterministic. Handles missing nodes safely. Includes audit hash.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository, GraphNode, GraphEdge
from src.graph_brain.storage.graph_repository import BFSResult
from src.risk_models import _infer_sector, classify_risk


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Hop decay: how much risk attenuates per hop distance
HOP_DECAY: dict[int, float] = {
    0: 1.0,
    1: 0.70,
    2: 0.35,
    3: 0.15,
}

# Edge weight by relationship type / category
EDGE_WEIGHTS: dict[str, float] = {
    "AFFECTS": 1.0,
    "PROPAGATES_TO": 0.9,
    "DEPENDS_ON": 0.8,
    "CORRELATES_WITH": 0.6,
    # Seed data categories mapped to weights
    "critical_path": 1.0,
    "production": 0.9,
    "logistics": 0.85,
    "trade_flow": 0.9,
    "revenue": 0.85,
    "risk_transfer": 0.8,
    "transport": 0.75,
    "market_signal": 0.7,
    "operations": 0.75,
    "regional_control": 0.7,
    "capital": 0.7,
    "welfare": 0.6,
    "influence": 0.55,
    "feedback": 0.6,
    "cost_pressure": 0.65,
    "capacity": 0.7,
    "critical_infrastructure": 0.9,
    "mobility": 0.6,
}

DEFAULT_EDGE_WEIGHT = 0.5


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class NodeRisk:
    """Risk assessment for a single node in the propagation graph."""
    node_id: str
    total_risk: float
    max_path_risk: float
    hops: int
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "total_risk": round(self.total_risk, 6),
            "max_path_risk": round(self.max_path_risk, 6),
            "hops": self.hops,
            "source": self.source,
        }


@dataclass
class PropagationResult:
    """Complete result of a risk propagation analysis."""
    root_entity: str
    impacted_nodes: list[NodeRisk]
    total_system_risk: float
    max_chain: float
    critical_paths: list[list[str]]
    audit_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "root_entity": self.root_entity,
            "impacted_nodes": [n.to_dict() for n in self.impacted_nodes],
            "total_system_risk": round(self.total_system_risk, 6),
            "max_chain": round(self.max_chain, 6),
            "critical_paths": self.critical_paths,
            "audit_hash": self.audit_hash,
        }


# ---------------------------------------------------------------------------
# Base risk scoring
# ---------------------------------------------------------------------------

def _compute_base_risk(node_id: str, node: GraphNode | None) -> float:
    """Compute base risk for a node using heuristic sector-aware scoring.

    Uses the existing _infer_sector from risk_models (same logic as URS).
    Does NOT modify or call RiskEngine directly — uses its sector inference.
    """
    if node is None:
        return 0.3  # Unknown node default

    layer = node.type if node.type else node.properties.get("layer", "")
    sector = _infer_sector(node_id)

    # Base risk by layer (infrastructure = high, society = lower)
    layer_risk: dict[str, float] = {
        "infrastructure": 0.75,
        "economy": 0.65,
        "finance": 0.70,
        "geography": 0.50,
        "society": 0.40,
    }

    # Sector sensitivity boost (from existing cross-sector dependency logic)
    sector_boost: dict[str, float] = {
        "energy": 0.15,
        "maritime": 0.12,
        "banking": 0.10,
        "insurance": 0.08,
        "logistics": 0.08,
        "fintech": 0.05,
        "infrastructure": 0.10,
        "government": 0.05,
    }

    base = layer_risk.get(layer, 0.50)
    boost = sector_boost.get(sector, 0.0)
    return min(base + boost, 1.0)


def _get_edge_weight(edge: GraphEdge) -> float:
    """Resolve edge weight from GraphEdge type or properties."""
    # Check type (maps to category in seed data, rel_type in Neo4j)
    if edge.type in EDGE_WEIGHTS:
        return EDGE_WEIGHTS[edge.type]

    # Check properties for category or relationship type
    category = edge.properties.get("category", "")
    if category in EDGE_WEIGHTS:
        return EDGE_WEIGHTS[category]

    # Use explicit weight if meaningful
    if edge.weight and edge.weight != 1.0:
        return edge.weight

    return DEFAULT_EDGE_WEIGHT


# ---------------------------------------------------------------------------
# Core propagation
# ---------------------------------------------------------------------------

def propagate_risk(
    entity_id: str,
    depth: int = 3,
    min_risk_threshold: float = 0.01,
    max_nodes: int = 50,
    repo: GraphRepository | None = None,
) -> PropagationResult:
    """Propagate risk from a root entity through the knowledge graph.

    Args:
        entity_id: Root node ID to start propagation from.
        depth: Maximum BFS traversal depth (default 3, max 5).
        min_risk_threshold: Minimum propagated_score to include a node.
        max_nodes: Maximum number of impacted nodes to return.
        repo: Optional GraphRepository override (default: auto from factory).

    Returns:
        PropagationResult with impacted nodes, critical paths, and audit hash.
    """
    if repo is None:
        repo = get_repository()

    depth = min(max(depth, 1), 5)

    # Handle missing root node
    if not repo.has_node(entity_id):
        return PropagationResult(
            root_entity=entity_id,
            impacted_nodes=[],
            total_system_risk=0.0,
            max_chain=0.0,
            critical_paths=[],
            audit_hash=_compute_audit_hash(entity_id, [], 0.0),
        )

    # ── BFS traversal via GraphRepository ───────────────────────────────
    bfs_results: list[BFSResult] = repo.bfs(entity_id, depth)

    # ── Risk computation per node ───────────────────────────────────────
    node_risks: dict[str, NodeRisk] = {}
    all_paths: list[tuple[list[str], float]] = []

    for bfs_item in bfs_results:
        node_id = bfs_item.node_id
        hops = bfs_item.depth
        path_edges = bfs_item.path_edges

        if node_id == entity_id:
            # Root node gets full base risk
            node = repo.get_node(node_id)
            base = _compute_base_risk(node_id, node)
            node_risks[node_id] = NodeRisk(
                node_id=node_id,
                total_risk=base,
                max_path_risk=base,
                hops=0,
                source=entity_id,
            )
            continue

        node = repo.get_node(node_id)
        base_score = _compute_base_risk(node_id, node)
        decay = HOP_DECAY.get(hops, 0.15 / (hops + 1))

        # Edge weight: use the last edge in the path to this node
        if path_edges:
            last_edge = path_edges[-1]
            edge_weight = _get_edge_weight(last_edge)
        else:
            edge_weight = DEFAULT_EDGE_WEIGHT

        propagated_score = base_score * decay * edge_weight

        if propagated_score < min_risk_threshold:
            continue

        # Build path for critical path tracking
        path_ids = [entity_id] + [_edge_target(e, entity_id, path_edges, i) for i, e in enumerate(path_edges)]
        # Cumulative path risk
        cumulative = base_score
        for i, edge in enumerate(path_edges):
            hop_d = HOP_DECAY.get(i + 1, 0.15)
            ew = _get_edge_weight(edge)
            cumulative *= hop_d * ew
        all_paths.append((path_ids, cumulative))

        if node_id in node_risks:
            existing = node_risks[node_id]
            existing.total_risk += propagated_score
            existing.max_path_risk = max(existing.max_path_risk, propagated_score)
            existing.hops = min(existing.hops, hops)
        else:
            node_risks[node_id] = NodeRisk(
                node_id=node_id,
                total_risk=propagated_score,
                max_path_risk=propagated_score,
                hops=hops,
                source=entity_id,
            )

    # ── Sort and limit ──────────────────────────────────────────────────
    impacted = [nr for nid, nr in node_risks.items() if nid != entity_id]
    impacted.sort(key=lambda n: -n.total_risk)
    impacted = impacted[:max_nodes]

    # ── Critical paths (top 3 by cumulative risk) ───────────────────────
    all_paths.sort(key=lambda x: -x[1])
    seen_paths: set[str] = set()
    critical_paths: list[list[str]] = []
    for path_ids, _ in all_paths:
        key = "→".join(path_ids)
        if key not in seen_paths and len(path_ids) > 1:
            seen_paths.add(key)
            critical_paths.append(path_ids)
            if len(critical_paths) >= 3:
                break

    # ── System-level aggregates ─────────────────────────────────────────
    total_system_risk = sum(n.total_risk for n in impacted)
    max_chain = max((n.max_path_risk for n in impacted), default=0.0)

    # ── Audit hash ──────────────────────────────────────────────────────
    audit_hash = _compute_audit_hash(entity_id, impacted, total_system_risk)

    return PropagationResult(
        root_entity=entity_id,
        impacted_nodes=impacted,
        total_system_risk=total_system_risk,
        max_chain=max_chain,
        critical_paths=critical_paths,
        audit_hash=audit_hash,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _edge_target(edge: GraphEdge, root: str, all_edges: list[GraphEdge], index: int) -> str:
    """Reconstruct the node ID at a given position in the BFS path.

    For InMemoryRepository BFS, edges trace the path sequentially.
    The target of each edge (or source if reversed) gives the next node.
    """
    # In a BFS path, each edge connects the previous node to the next.
    # Since BFS is from root, the node at position i+1 in the path is
    # the "other end" of edge[i] relative to the previous node.
    if index == 0:
        prev = root
    else:
        prev = _edge_target(all_edges[index - 1], root, all_edges, index - 1)

    if edge.source == prev:
        return edge.target
    return edge.source


def _compute_audit_hash(
    root: str,
    impacted: list[NodeRisk],
    total_risk: float,
) -> str:
    """SHA-256 hash of root + impacted node IDs + total_system_risk."""
    payload = json.dumps({
        "root": root,
        "nodes": [n.node_id for n in impacted],
        "total_system_risk": round(total_risk, 6),
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
