"""Impact Observatory | مرصد الأثر — Repository Factory.

Single entry point for graph access. Returns the appropriate
GraphRepository implementation based on environment:

  production → Neo4jRepository
  otherwise  → InMemoryRepository (default, zero-config)

Usage:
    from src.graph_brain.storage import get_repository
    repo = get_repository()
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from src.graph_brain.storage.graph_repository import GraphRepository

if TYPE_CHECKING:
    pass

logger = logging.getLogger("observatory.storage")

# Singleton cache
_instance: GraphRepository | None = None


def get_repository(force_backend: str | None = None) -> GraphRepository:
    """Get the active GraphRepository singleton.

    Args:
        force_backend: Override auto-detection. "neo4j" or "memory".
                       Use for testing or explicit control.

    Returns:
        GraphRepository implementation.

    Auto-detection logic:
        1. If force_backend is set, use that.
        2. If APP_ENV == "production", use Neo4j.
        3. Otherwise, use InMemory (default for dev).
    """
    global _instance

    if _instance is not None and force_backend is None:
        return _instance

    backend = force_backend
    if backend is None:
        from src.core.config import settings
        backend = "neo4j" if settings.app_env == "production" else "memory"

    if backend == "neo4j":
        from src.graph_brain.storage.neo4j_repository import Neo4jRepository
        _instance = Neo4jRepository()
        logger.info("Graph repository: Neo4j (production)")
    else:
        from src.graph_brain.storage.inmemory_repository import InMemoryRepository
        _instance = InMemoryRepository()
        logger.info("Graph repository: InMemory (development)")

    return _instance


def reset_repository() -> None:
    """Reset the singleton. Used in tests."""
    global _instance
    _instance = None
