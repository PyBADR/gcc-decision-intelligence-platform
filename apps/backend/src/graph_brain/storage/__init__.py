"""Impact Observatory | مرصد الأثر — Graph Storage Layer.

Single source of truth for all graph access.
All modules use GraphRepository — never Neo4j or memory directly.

Usage:
    from src.graph_brain.storage import get_repository
    repo = get_repository()
    node = repo.get_node("hormuz")
"""

from src.graph_brain.storage.graph_repository import GraphRepository, GraphNode, GraphEdge
from src.graph_brain.storage.factory import get_repository

__all__ = [
    "GraphRepository",
    "GraphNode",
    "GraphEdge",
    "get_repository",
]
