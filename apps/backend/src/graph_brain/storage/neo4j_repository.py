"""Impact Observatory | مرصد الأثر — Neo4j Graph Repository.

Production backend. Uses async Neo4j driver via src.db.neo4j.
Maps Cypher results into standard GraphNode/GraphEdge models.

NOTE: This is a sync-compatible wrapper. BFS and path queries use
Cypher-native traversal (not Python-side BFS) for performance.
For the async ingestion path, use upsert_node/upsert_edge.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from typing import Any

from src.graph_brain.storage.graph_repository import (
    GraphRepository,
    GraphNode,
    GraphEdge,
    BFSResult,
    PathResult,
)

logger = logging.getLogger("observatory.storage.neo4j")


def _get_event_loop():
    """Get or create an event loop for sync-to-async bridging."""
    try:
        loop = asyncio.get_running_loop()
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


def _run_async(coro):
    """Run async coroutine from sync context."""
    try:
        loop = asyncio.get_running_loop()
        # Already in async context — create task
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result(timeout=10)
    except RuntimeError:
        return asyncio.run(coro)


class Neo4jRepository(GraphRepository):
    """Neo4j-backed graph repository.

    Uses Cypher queries for traversal, maps results to GraphNode/GraphEdge.
    Falls back gracefully if Neo4j is not connected.
    """

    def _get_session(self):
        """Get Neo4j async session context manager."""
        from src.db.neo4j import get_neo4j_session
        return get_neo4j_session()

    # ── Read interface ──────────────────────────────────────────────────

    def get_node(self, node_id: str) -> GraphNode | None:
        async def _query():
            try:
                async with self._get_session() as session:
                    result = await session.run(
                        "MATCH (n {id: $id}) RETURN n, labels(n) AS labels LIMIT 1",
                        id=node_id,
                    )
                    record = await result.single()
                    if not record:
                        return None
                    n = record["n"]
                    labels = record["labels"]
                    props = dict(n)
                    node_type = labels[0].lower() if labels else "unknown"
                    return GraphNode(
                        id=node_id,
                        type=node_type,
                        properties=props,
                    )
            except Exception as e:
                logger.warning("Neo4j get_node failed: %s", e)
                return None
        return _run_async(_query())

    def has_node(self, node_id: str) -> bool:
        return self.get_node(node_id) is not None

    def get_neighbors(self, node_id: str) -> list[tuple[GraphNode, GraphEdge]]:
        async def _query():
            try:
                async with self._get_session() as session:
                    result = await session.run(
                        """
                        MATCH (n {id: $id})-[r]-(neighbor)
                        WHERE neighbor.id IS NOT NULL
                        RETURN neighbor, labels(neighbor) AS labels,
                               type(r) AS rel_type, r.weight AS weight
                        """,
                        id=node_id,
                    )
                    neighbors: list[tuple[GraphNode, GraphEdge]] = []
                    async for record in result:
                        nb = record["neighbor"]
                        labels = record["labels"]
                        rel_type = record["rel_type"]
                        weight = record["weight"] or 1.0

                        node = GraphNode(
                            id=nb["id"],
                            type=labels[0].lower() if labels else "unknown",
                            properties=dict(nb),
                        )
                        edge = GraphEdge(
                            source=node_id,
                            target=nb["id"],
                            type=rel_type,
                            weight=float(weight),
                        )
                        neighbors.append((node, edge))
                    return neighbors
            except Exception as e:
                logger.warning("Neo4j get_neighbors failed: %s", e)
                return []
        return _run_async(_query())

    def bfs(self, node_id: str, depth: int) -> list[BFSResult]:
        async def _query():
            try:
                async with self._get_session() as session:
                    # Use Cypher variable-length path for BFS
                    query = (
                        "MATCH path = (start {id: $id})-[*0.." + str(depth) + "]-(end) "
                        "WHERE end.id IS NOT NULL "
                        "WITH end, min(length(path)) AS min_depth, "
                        "     collect(relationships(path)) AS all_rels "
                        "RETURN end.id AS node_id, min_depth AS depth, "
                        "       labels(end) AS labels "
                        "ORDER BY depth, node_id"
                    )
                    result = await session.run(query, id=node_id)
                    results: list[BFSResult] = []
                    seen: set[str] = set()
                    async for record in result:
                        nid = record["node_id"]
                        if nid in seen:
                            continue
                        seen.add(nid)
                        results.append(BFSResult(
                            node_id=nid,
                            depth=record["depth"],
                            path_edges=[],  # Cypher returns paths differently
                        ))
                    return results
            except Exception as e:
                logger.warning("Neo4j BFS failed: %s", e)
                return []
        return _run_async(_query())

    def find_paths(
        self, source: str, target: str, max_depth: int = 5
    ) -> list[PathResult]:
        async def _query():
            try:
                async with self._get_session() as session:
                    query = (
                        "MATCH path = (s {id: $source})-[*1.." + str(max_depth) + "]-(t {id: $target}) "
                        "WITH path, "
                        "     [n IN nodes(path) | n.id] AS node_ids, "
                        "     [r IN relationships(path) | {type: type(r), weight: coalesce(r.weight, 1.0)}] AS rels, "
                        "     reduce(w = 1.0, r IN relationships(path) | w * coalesce(r.weight, 1.0)) AS total_w "
                        "RETURN node_ids, rels, total_w "
                        "ORDER BY total_w DESC "
                        "LIMIT 10"
                    )
                    result = await session.run(query, source=source, target=target)
                    paths: list[PathResult] = []
                    async for record in result:
                        edges = [
                            GraphEdge(
                                source="", target="",
                                type=r["type"],
                                weight=r["weight"],
                            )
                            for r in record["rels"]
                        ]
                        paths.append(PathResult(
                            nodes=record["node_ids"],
                            edges=edges,
                            total_weight=record["total_w"],
                        ))
                    return paths
            except Exception as e:
                logger.warning("Neo4j find_paths failed: %s", e)
                return []
        return _run_async(_query())

    def get_all_nodes(self) -> list[GraphNode]:
        async def _query():
            try:
                async with self._get_session() as session:
                    result = await session.run(
                        "MATCH (n) WHERE n.id IS NOT NULL "
                        "RETURN n, labels(n) AS labels "
                        "LIMIT 1000"
                    )
                    nodes: list[GraphNode] = []
                    async for record in result:
                        n = record["n"]
                        labels = record["labels"]
                        nodes.append(GraphNode(
                            id=n["id"],
                            type=labels[0].lower() if labels else "unknown",
                            properties=dict(n),
                        ))
                    return nodes
            except Exception as e:
                logger.warning("Neo4j get_all_nodes failed: %s", e)
                return []
        return _run_async(_query())

    def get_all_edges(self) -> list[GraphEdge]:
        async def _query():
            try:
                async with self._get_session() as session:
                    result = await session.run(
                        "MATCH (a)-[r]->(b) "
                        "WHERE a.id IS NOT NULL AND b.id IS NOT NULL "
                        "RETURN a.id AS source, b.id AS target, "
                        "       type(r) AS rel_type, r.weight AS weight "
                        "LIMIT 5000"
                    )
                    edges: list[GraphEdge] = []
                    async for record in result:
                        edges.append(GraphEdge(
                            source=record["source"],
                            target=record["target"],
                            type=record["rel_type"],
                            weight=float(record["weight"] or 1.0),
                        ))
                    return edges
            except Exception as e:
                logger.warning("Neo4j get_all_edges failed: %s", e)
                return []
        return _run_async(_query())

    # ── Write interface ─────────────────────────────────────────────────

    def upsert_node(self, node: GraphNode) -> None:
        async def _write():
            try:
                async with self._get_session() as session:
                    label = node.type.capitalize() if node.type else "Entity"
                    props = {k: v for k, v in node.properties.items() if v is not None}
                    await session.run(
                        f"MERGE (n:{label} {{id: $id}}) SET n += $props",
                        id=node.id,
                        props=props,
                    )
            except Exception as e:
                logger.error("Neo4j upsert_node failed: %s", e)
                raise
        _run_async(_write())

    def upsert_edge(self, edge: GraphEdge) -> None:
        async def _write():
            try:
                async with self._get_session() as session:
                    rel_type = edge.type.upper().replace(" ", "_")
                    await session.run(
                        f"MATCH (a {{id: $source}}), (b {{id: $target}}) "
                        f"MERGE (a)-[r:{rel_type}]->(b) "
                        f"SET r.weight = $weight",
                        source=edge.source,
                        target=edge.target,
                        weight=edge.weight,
                    )
            except Exception as e:
                logger.error("Neo4j upsert_edge failed: %s", e)
                raise
        _run_async(_write())
