"""Impact Observatory | مرصد الأثر — Signal Ingestion Service.

Orchestrates: validate → quarantine check → map → Neo4j MERGE.

Signal flow:
  MacroSignal → confidence gate → Signal node → Event node → [:TRIGGERS]
  Low-confidence signals get :LowConfidence label.
  Quarantined signals (< 0.30) are logged but never written to KG.
"""

from __future__ import annotations

import logging
from typing import Any

from src.db.neo4j import get_neo4j_session
from src.schemas.macro_signal import MacroSignal, IngestResult, ConfidenceTier

logger = logging.getLogger("observatory.ingestion")


# ---------------------------------------------------------------------------
# Cypher templates
# ---------------------------------------------------------------------------

UPSERT_SIGNAL = """
MERGE (s:Signal {id: $id})
SET s.type        = $type,
    s.source      = $source,
    s.event_time  = datetime($event_time),
    s.ingested_at = datetime($ingested_at),
    s.confidence  = $confidence,
    s.confidence_tier = $confidence_tier,
    s.lineage_hash = $lineage_hash,
    s.tags        = $tags
RETURN s.id AS id
"""

UPSERT_EVENT = """
MERGE (e:Event {id: $event_id})
SET e.type       = $type,
    e.event_time = datetime($event_time),
    e.source     = 'signal_ingestion',
    e.signal_id  = $signal_id
RETURN e.id AS id
"""

CREATE_TRIGGERS = """
MATCH (s:Signal {id: $signal_id})
MATCH (e:Event {id: $event_id})
MERGE (s)-[:TRIGGERS]->(e)
"""

LABEL_LOW_CONFIDENCE = """
MATCH (s:Signal {id: $signal_id})
SET s:LowConfidence
"""

STORE_PAYLOAD_PROPS = """
MATCH (s:Signal {id: $signal_id})
SET s += $props
"""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

async def ingest_signal(signal: MacroSignal) -> IngestResult:
    """Process a macro signal and write to the Knowledge Graph.

    Args:
        signal: Validated MacroSignal instance.

    Returns:
        IngestResult with IDs, tier, and write status.
    """
    # ── Quarantine gate ─────────────────────────────────────────────────
    if signal.should_quarantine:
        logger.warning(
            "Signal %s quarantined (confidence=%.2f)",
            signal.id, signal.confidence,
        )
        return IngestResult(
            signal_id=signal.id,
            event_id=signal.event_id,
            confidence_tier=ConfidenceTier.quarantine,
            quarantined=True,
            neo4j_written=False,
            lineage_hash=signal.lineage_hash or "",
        )

    # ── Prepare parameters ──────────────────────────────────────────────
    signal_params: dict[str, Any] = {
        "id": signal.id,
        "type": signal.type.value,
        "source": signal.source.value,
        "event_time": signal.event_time.isoformat(),
        "ingested_at": signal.ingested_at.isoformat(),
        "confidence": signal.confidence,
        "confidence_tier": signal.confidence_tier.value if signal.confidence_tier else "standard",
        "lineage_hash": signal.lineage_hash or "",
        "tags": signal.tags,
    }

    event_params: dict[str, Any] = {
        "event_id": signal.event_id,
        "type": signal.type.value,
        "event_time": signal.event_time.isoformat(),
        "signal_id": signal.id,
    }

    rel_params: dict[str, str] = {
        "signal_id": signal.id,
        "event_id": signal.event_id,
    }

    # Extract flat payload properties for Signal node
    payload_props = _flatten_payload(signal)

    # ── Write to Neo4j ──────────────────────────────────────────────────
    async with get_neo4j_session() as session:
        # 1. MERGE Signal node
        await session.run(UPSERT_SIGNAL, signal_params)
        logger.info("Signal %s upserted", signal.id)

        # 2. Store payload as properties on Signal node
        if payload_props:
            await session.run(STORE_PAYLOAD_PROPS, {
                "signal_id": signal.id,
                "props": payload_props,
            })

        # 3. MERGE Event node
        await session.run(UPSERT_EVENT, event_params)
        logger.info("Event %s upserted", signal.event_id)

        # 4. MERGE (Signal)-[:TRIGGERS]->(Event)
        await session.run(CREATE_TRIGGERS, rel_params)

        # 5. Label low-confidence signals
        if signal.confidence_tier == ConfidenceTier.low:
            await session.run(LABEL_LOW_CONFIDENCE, {"signal_id": signal.id})
            logger.info("Signal %s labelled :LowConfidence", signal.id)

    return IngestResult(
        signal_id=signal.id,
        event_id=signal.event_id,
        confidence_tier=signal.confidence_tier or ConfidenceTier.standard,
        quarantined=False,
        neo4j_written=True,
        lineage_hash=signal.lineage_hash or "",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _flatten_payload(signal: MacroSignal) -> dict[str, Any]:
    """Extract serializable top-level properties from the payload.

    Neo4j properties must be primitives (str, int, float, bool, list[str]).
    Nested dicts are JSON-serialized to strings.
    """
    import json

    if isinstance(signal.payload, dict):
        raw = signal.payload
    else:
        raw = signal.payload.model_dump()

    flat: dict[str, Any] = {}
    for k, v in raw.items():
        if k == "domain":
            continue  # already stored as signal.type
        prefixed = f"payload_{k}"
        if isinstance(v, (str, int, float, bool)):
            flat[prefixed] = v
        elif isinstance(v, list) and all(isinstance(i, str) for i in v):
            flat[prefixed] = v
        elif v is not None:
            flat[prefixed] = json.dumps(v)

    return flat
