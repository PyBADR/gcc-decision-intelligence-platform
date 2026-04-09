"""Unified Decision API — Single Brain Endpoint.

Aggregates Macro Intelligence, Graph Insights, Portfolio Risk,
and Underwriting Decision into one coherent response.
"""

from src.api.v1.unified_decision.decision_routes import router

__all__ = ["router"]
