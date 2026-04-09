"""Integration — Decision Logging into Unified Decision API.

Wraps the evaluate_unified function to automatically log every decision.
Zero-impact on performance: logging failures never break the pipeline.
"""

from __future__ import annotations

from typing import Any

from src.core.audit.logger import DecisionLogger, get_decision_logger


def log_unified_decision(
    input_data: dict[str, Any],
    output_data: dict[str, Any],
    decision_logger: DecisionLogger | None = None,
) -> dict[str, Any]:
    """Log a unified decision and inject logging metadata into the response.

    Args:
        input_data: Original request parameters.
        output_data: Full unified decision response.
        decision_logger: Optional logger override.

    Returns:
        The output_data with `logging` section added.
    """
    dl = decision_logger or get_decision_logger()
    log_result = dl.log_decision(input_data=input_data, output_data=output_data)

    # Inject logging metadata into response
    output_data["logging"] = {
        "decision_id": log_result.get("decision_id", ""),
        "audit_id": log_result.get("audit_id", ""),
        "chain_hash": log_result.get("chain_hash", ""),
        "logged": bool(log_result.get("decision_id")),
    }

    return output_data
