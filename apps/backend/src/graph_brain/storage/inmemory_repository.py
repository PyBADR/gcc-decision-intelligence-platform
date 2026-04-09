"""Impact Observatory | مرصد الأثر — In-Memory Graph Repository.

Development and testing backend. Loads GCC_NODES/GCC_EDGES at init.
Deterministic — same data in, same results out.

Also supports writes (upsert_node, upsert_edge) so ingestion works
in dev mode without Neo4j.
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from src.graph_brain.storage.graph_repository import (
    GraphRepository,
    GraphNode,
    GraphEdge,
    BFSResult,
    PathResult,
)
from src.services.seed_data import GCC_NODES, GCC_EDGES


class InMemoryRepository(GraphRepository):
    """In-memory graph backed by GCC seed data.

    Bidirectional adjacency for undirected risk propagation traversal.
    O(1) node lookup, O(degree) neighbor lookup.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, GraphNode] = {}
        self._edges: list[GraphEdge] = []
        # Adjacency: node_id → [(neighbor_id, GraphEdge)]
        self._adj: dict[str, list[tuple[str, GraphEdge]]] = defaultdict(list)

        self._load_seed_data()

    def _load_seed_data(self) -> None:
        """Load GCC_NODES and GCC_EDGES into memory."""
        for raw in GCC_NODES:
            props = {k: v for k, v in raw.items() if k != "id"}
            node = GraphNode(
                id=raw["id"],
                type=raw.get("layer", "unknown"),
                properties=props,
            )
            self._nodes[node.id] = node

        for raw in GCC_EDGES:
            edge = GraphEdge(
                source=raw["source"],
                target=raw["target"],
                type=raw.get("category", "default"),
                weight=raw.get("weight", 1.0),
                properties={k: v for k, v in raw.items()
                            if k not in ("source", "target", "category", "weight")},
            )
            self._edges.append(edge)
            # Bidirectional
            self._adj[edge.source].append((edge.target, edge))
            self._adj[edge.target].append((edge.source, edge))

    # ── Read interface ──────────────────────────────────────────────────

    def get_node(self, node_id: str) -> GraphNode | None:
        return self._nodes.get(node_id)

    def has_node(self, node_id: str) -> bool:
        return node_id in self._nodes

    def get_neighbors(self, node_id: str) -> list[tuple[GraphNode, GraphEdge]]:
        results: list[tuple[GraphNode, GraphEdge]] = []
        for neighbor_id, edge in self._adj.get(node_id, []):
            neighbor = self._nodes.get(neighbor_id)
            if neighbor:
                results.append((neighbor, edge))
        return results

    def bfs(self, node_id: str, depth: int) -> list[BFSResult]:
        if node_id not in self._nodes:
            return []

        visited: set[str] = {node_id}
        queue: deque[tuple[str, int, list[GraphEdge]]] = deque()
        queue.append((node_id, 0, []))
        results: list[BFSResult] = [BFSResult(node_id=node_id, depth=0)]

        while queue:
            current, d, path = queue.popleft()
            if d >= depth:
                continue

            for neighbor_id, edge in self._adj.get(current, []):
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    new_path = path + [edge]
                    results.append(BFSResult(
                        node_id=neighbor_id,
                        depth=d + 1,
                        path_edges=new_path,
                    ))
                    queue.append((neighbor_id, d + 1, new_path))

        return results

    def find_paths(
        self, source: str, target: str, max_depth: int = 5
    ) -> list[PathResult]:
        if source not in self._nodes or target not in self._nodes:
            return []

        all_paths: list[PathResult] = []

        # DFS with depth limit
        stack: list[tuple[str, list[str], list[GraphEdge], float]] = [
            (source, [source], [], 1.0)
        ]

        while stack:
            current, path_nodes, path_edges, cum_weight = stack.pop()
            if current == target and len(path_nodes) > 1:
                all_paths.append(PathResult(
                    nodes=list(path_nodes),
                    edges=list(path_edges),
                    total_weight=cum_weight,
                ))
                continue

            if len(path_nodes) > max_depth:
                continue

            for neighbor_id, edge in self._adj.get(current, []):
                if neighbor_id not in path_nodes:
                    stack.append((
                        neighbor_id,
                        path_nodes + [neighbor_id],
                        path_edges + [edge],
                        cum_weight * edge.weight,
                    ))

        all_paths.sort(key=lambda p: -p.total_weight)
        return all_paths[:10]

    def get_all_nodes(self) -> list[GraphNode]:
        return list(self._nodes.values())

    def get_all_edges(self) -> list[GraphEdge]:
        return list(self._edges)

    # ── Write interface (dev mode) ──────────────────────────────────────

    def upsert_node(self, node: GraphNode) -> None:
        """Create or update a node in memory."""
        if node.id in self._nodes:
            existing = self._nodes[node.id]
            existing.type = node.type
            existing.properties.update(node.properties)
        else:
            self._nodes[node.id] = node

    def upsert_edge(self, edge: GraphEdge) -> None:
        """Create or update an edge in memory."""
        # Check if edge already exists
        for i, existing in enumerate(self._edges):
            if existing.source == edge.source and existing.target == edge.target and existing.type == edge.type:
                self._edges[i] = edge
                return

        self._edges.append(edge)
        self._adj[edge.source].append((edge.target, edge))
        self._adj[edge.target].append((edge.source, edge))
