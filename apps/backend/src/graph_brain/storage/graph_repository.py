"""Impact Observatory | مرصد الأثر — Graph Repository (Abstract Interface).

All graph access in the system flows through this interface.
Implementations: Neo4jRepository (production), InMemoryRepository (dev/test).

Never import GCC_NODES, GCC_EDGES, or get_neo4j_session directly.
Always use: get_repository() → GraphRepository
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Canonical data models
# ---------------------------------------------------------------------------

@dataclass
class GraphNode:
    """Standard node representation across all backends."""
    id: str
    type: str  # layer/label type
    properties: dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        """Dict-like access to properties for backward compatibility."""
        if key == "id":
            return self.id
        if key == "type":
            return self.type
        return self.properties.get(key, default)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "type": self.type, **self.properties}


@dataclass
class GraphEdge:
    """Standard edge representation across all backends."""
    source: str
    target: str
    type: str  # relationship type or category
    weight: float = 1.0
    properties: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type,
            "weight": self.weight,
            **self.properties,
        }


@dataclass
class BFSResult:
    """Single node visited during BFS traversal."""
    node_id: str
    depth: int
    path_edges: list[GraphEdge] = field(default_factory=list)


@dataclass
class PathResult:
    """A path between two nodes."""
    nodes: list[str]
    edges: list[GraphEdge]
    total_weight: float


# ---------------------------------------------------------------------------
# Abstract Repository
# ---------------------------------------------------------------------------

class GraphRepository(ABC):
    """Abstract interface for all graph storage backends.

    Every module in the system accesses graph data through this interface.
    Implementations must be deterministic for the same input data.
    """

    @abstractmethod
    def get_node(self, node_id: str) -> GraphNode | None:
        """Return a node by ID, or None if not found."""
        ...

    @abstractmethod
    def get_neighbors(self, node_id: str) -> list[tuple[GraphNode, GraphEdge]]:
        """Return [(neighbor_node, connecting_edge)] for a given node.

        Includes both outgoing and incoming edges (undirected traversal).
        """
        ...

    @abstractmethod
    def bfs(self, node_id: str, depth: int) -> list[BFSResult]:
        """BFS traversal from node_id up to max depth.

        Returns list of BFSResult (node_id, depth, path_edges).
        Root node is included at depth 0 with empty path.
        """
        ...

    @abstractmethod
    def find_paths(
        self, source: str, target: str, max_depth: int = 5
    ) -> list[PathResult]:
        """Find all paths between source and target up to max_depth.

        Returns list of PathResult sorted by total_weight descending.
        """
        ...

    @abstractmethod
    def get_all_nodes(self) -> list[GraphNode]:
        """Return all nodes in the graph."""
        ...

    @abstractmethod
    def get_all_edges(self) -> list[GraphEdge]:
        """Return all edges in the graph."""
        ...

    @abstractmethod
    def has_node(self, node_id: str) -> bool:
        """Check if a node exists."""
        ...

    # ── Optional write methods (for ingestion) ──────────────────────────

    def upsert_node(self, node: GraphNode) -> None:
        """Create or update a node. Override in writable backends."""
        raise NotImplementedError("This repository is read-only")

    def upsert_edge(self, edge: GraphEdge) -> None:
        """Create or update an edge. Override in writable backends."""
        raise NotImplementedError("This repository is read-only")
