"""Core Audit — Repository for decision persistence.

SQLite for local dev, PostgreSQL-compatible schema.
Thread-safe singleton via get_audit_repository().

Tables:
  decisions         — full decision records
  decision_audit    — immutable hash chain
  decision_outcomes — feedback loop
"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from src.core.audit.models import (
    DecisionRecord,
    AuditRecord,
    OutcomeRecord,
    DecisionStatus,
)

_instance: AuditRepository | None = None
_lock = threading.Lock()

# Default SQLite path (in project data dir)
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "data" / "decisions.db"


class AuditRepository:
    """Persistent storage for decision records and audit trail.

    Uses SQLite locally. Schema is PostgreSQL-compatible for production.
    """

    def __init__(self, db_path: str | Path | None = None) -> None:
        self._db_path = str(db_path or _DEFAULT_DB_PATH)
        self._ensure_dir()
        self._init_schema()
        self._last_audit_hash: str = ""

    # -------------------------------------------------------------------
    # Schema initialization
    # -------------------------------------------------------------------

    def _ensure_dir(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_schema(self) -> None:
        conn = self._conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS decisions (
                    id TEXT PRIMARY KEY,
                    entity_id TEXT NOT NULL,
                    entity_label TEXT DEFAULT '',
                    portfolio_id TEXT,
                    sector TEXT DEFAULT '',

                    decision TEXT NOT NULL,
                    risk_score REAL NOT NULL,
                    risk_level TEXT DEFAULT '',
                    confidence REAL DEFAULT 0.0,

                    pricing TEXT DEFAULT '{}',
                    coverage TEXT DEFAULT '{}',
                    conditions TEXT DEFAULT '[]',

                    macro_context TEXT DEFAULT '{}',
                    graph_context TEXT DEFAULT '{}',
                    portfolio_context TEXT,
                    underwriting_context TEXT DEFAULT '{}',

                    explanation TEXT DEFAULT '[]',
                    decision_summary TEXT DEFAULT '',

                    input_params TEXT DEFAULT '{}',
                    model_versions TEXT DEFAULT '{}',

                    status TEXT DEFAULT 'active',
                    timing_ms REAL DEFAULT 0.0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS decision_audit (
                    id TEXT PRIMARY KEY,
                    decision_id TEXT NOT NULL REFERENCES decisions(id),

                    macro_hash TEXT DEFAULT '',
                    graph_hash TEXT DEFAULT '',
                    underwriting_hash TEXT DEFAULT '',
                    unified_hash TEXT DEFAULT '',

                    input_hash TEXT NOT NULL,
                    output_hash TEXT NOT NULL,

                    previous_hash TEXT DEFAULT '',
                    chain_hash TEXT NOT NULL,

                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS decision_outcomes (
                    id TEXT PRIMARY KEY,
                    decision_id TEXT NOT NULL REFERENCES decisions(id),

                    outcome TEXT NOT NULL,
                    severity REAL DEFAULT 0.0,
                    actual_loss_amount REAL DEFAULT 0.0,
                    notes TEXT DEFAULT '',

                    observed_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_decisions_entity
                    ON decisions(entity_id);
                CREATE INDEX IF NOT EXISTS idx_decisions_sector
                    ON decisions(sector);
                CREATE INDEX IF NOT EXISTS idx_decisions_decision
                    ON decisions(decision);
                CREATE INDEX IF NOT EXISTS idx_decisions_created
                    ON decisions(created_at);
                CREATE INDEX IF NOT EXISTS idx_decisions_status
                    ON decisions(status);

                CREATE INDEX IF NOT EXISTS idx_audit_decision_id
                    ON decision_audit(decision_id);
                CREATE INDEX IF NOT EXISTS idx_audit_chain
                    ON decision_audit(chain_hash);

                CREATE INDEX IF NOT EXISTS idx_outcomes_decision_id
                    ON decision_outcomes(decision_id);
            """)
            conn.commit()
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Decision CRUD
    # -------------------------------------------------------------------

    def save_decision(self, record: DecisionRecord) -> str:
        """Persist a decision record. Returns decision ID."""
        conn = self._conn()
        try:
            conn.execute(
                """
                INSERT INTO decisions (
                    id, entity_id, entity_label, portfolio_id, sector,
                    decision, risk_score, risk_level, confidence,
                    pricing, coverage, conditions,
                    macro_context, graph_context, portfolio_context,
                    underwriting_context, explanation, decision_summary,
                    input_params, model_versions,
                    status, timing_ms, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?,
                    ?, ?, ?
                )
                """,
                (
                    record.id,
                    record.entity_id,
                    record.entity_label,
                    record.portfolio_id,
                    record.sector,
                    record.decision,
                    record.risk_score,
                    record.risk_level,
                    record.confidence,
                    json.dumps(record.pricing),
                    json.dumps(record.coverage),
                    json.dumps(record.conditions),
                    json.dumps(record.macro_context),
                    json.dumps(record.graph_context),
                    json.dumps(record.portfolio_context) if record.portfolio_context else None,
                    json.dumps(record.underwriting_context),
                    json.dumps(record.explanation),
                    record.decision_summary,
                    json.dumps(record.input_params),
                    json.dumps(record.model_versions),
                    record.status.value,
                    record.timing_ms,
                    record.created_at,
                ),
            )
            conn.commit()
            return record.id
        finally:
            conn.close()

    def get_decision(self, decision_id: str) -> DecisionRecord | None:
        """Retrieve a decision by ID."""
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT * FROM decisions WHERE id = ?", (decision_id,)
            ).fetchone()
            if not row:
                return None
            return self._row_to_decision(row)
        finally:
            conn.close()

    def list_decisions(
        self,
        entity_id: str | None = None,
        sector: str | None = None,
        decision: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DecisionRecord]:
        """List decisions with optional filters."""
        conn = self._conn()
        try:
            query = "SELECT * FROM decisions WHERE 1=1"
            params: list[Any] = []

            if entity_id:
                query += " AND entity_id = ?"
                params.append(entity_id)
            if sector:
                query += " AND sector = ?"
                params.append(sector)
            if decision:
                query += " AND decision = ?"
                params.append(decision)
            if status:
                query += " AND status = ?"
                params.append(status)

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            rows = conn.execute(query, params).fetchall()
            return [self._row_to_decision(r) for r in rows]
        finally:
            conn.close()

    def count_decisions(
        self,
        entity_id: str | None = None,
        decision: str | None = None,
    ) -> int:
        """Count decisions with optional filters."""
        conn = self._conn()
        try:
            query = "SELECT COUNT(*) FROM decisions WHERE 1=1"
            params: list[Any] = []
            if entity_id:
                query += " AND entity_id = ?"
                params.append(entity_id)
            if decision:
                query += " AND decision = ?"
                params.append(decision)
            return conn.execute(query, params).fetchone()[0]
        finally:
            conn.close()

    def update_status(
        self, decision_id: str, status: DecisionStatus
    ) -> bool:
        """Update decision status."""
        conn = self._conn()
        try:
            cursor = conn.execute(
                "UPDATE decisions SET status = ? WHERE id = ?",
                (status.value, decision_id),
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Audit trail
    # -------------------------------------------------------------------

    def save_audit(self, record: AuditRecord) -> str:
        """Persist an audit record. Returns audit ID."""
        conn = self._conn()
        try:
            conn.execute(
                """
                INSERT INTO decision_audit (
                    id, decision_id,
                    macro_hash, graph_hash, underwriting_hash, unified_hash,
                    input_hash, output_hash,
                    previous_hash, chain_hash,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.decision_id,
                    record.macro_hash,
                    record.graph_hash,
                    record.underwriting_hash,
                    record.unified_hash,
                    record.input_hash,
                    record.output_hash,
                    record.previous_hash,
                    record.chain_hash,
                    record.created_at,
                ),
            )
            conn.commit()
            self._last_audit_hash = record.chain_hash
            return record.id
        finally:
            conn.close()

    def get_audit_trail(self, decision_id: str) -> list[AuditRecord]:
        """Get full audit trail for a decision."""
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM decision_audit WHERE decision_id = ? ORDER BY created_at",
                (decision_id,),
            ).fetchall()
            return [self._row_to_audit(r) for r in rows]
        finally:
            conn.close()

    def get_latest_chain_hash(self) -> str:
        """Get the most recent chain hash for continuity."""
        if self._last_audit_hash:
            return self._last_audit_hash
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT chain_hash FROM decision_audit ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            self._last_audit_hash = row["chain_hash"] if row else ""
            return self._last_audit_hash
        finally:
            conn.close()

    def verify_chain_integrity(self) -> dict[str, Any]:
        """Verify the entire audit chain is untampered."""
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM decision_audit ORDER BY created_at"
            ).fetchall()

            if not rows:
                return {"valid": True, "records": 0, "breaks": []}

            breaks: list[dict[str, str]] = []
            prev_hash = ""

            for row in rows:
                expected = AuditRecord.compute_chain_hash(
                    decision_id=row["decision_id"],
                    input_hash=row["input_hash"],
                    output_hash=row["output_hash"],
                    previous_hash=prev_hash,
                )
                if row["chain_hash"] != expected:
                    breaks.append({
                        "audit_id": row["id"],
                        "decision_id": row["decision_id"],
                        "expected": expected,
                        "actual": row["chain_hash"],
                    })
                prev_hash = row["chain_hash"]

            return {
                "valid": len(breaks) == 0,
                "records": len(rows),
                "breaks": breaks,
            }
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Outcomes
    # -------------------------------------------------------------------

    def save_outcome(self, record: OutcomeRecord) -> str:
        """Record a decision outcome."""
        conn = self._conn()
        try:
            conn.execute(
                """
                INSERT INTO decision_outcomes (
                    id, decision_id, outcome, severity,
                    actual_loss_amount, notes, observed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.decision_id,
                    record.outcome,
                    record.severity,
                    record.actual_loss_amount,
                    record.notes,
                    record.observed_at,
                ),
            )
            conn.commit()
            return record.id
        finally:
            conn.close()

    def get_outcomes(self, decision_id: str) -> list[OutcomeRecord]:
        """Get outcomes for a decision."""
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM decision_outcomes WHERE decision_id = ? ORDER BY observed_at",
                (decision_id,),
            ).fetchall()
            return [self._row_to_outcome(r) for r in rows]
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Analytics
    # -------------------------------------------------------------------

    def get_statistics(self) -> dict[str, Any]:
        """Aggregate decision statistics."""
        conn = self._conn()
        try:
            total = conn.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]

            by_decision = {}
            for row in conn.execute(
                "SELECT decision, COUNT(*) as cnt FROM decisions GROUP BY decision"
            ).fetchall():
                by_decision[row["decision"]] = row["cnt"]

            by_sector = {}
            for row in conn.execute(
                "SELECT sector, COUNT(*) as cnt FROM decisions GROUP BY sector ORDER BY cnt DESC"
            ).fetchall():
                by_sector[row["sector"]] = row["cnt"]

            avg_risk = conn.execute(
                "SELECT AVG(risk_score) FROM decisions"
            ).fetchone()[0] or 0.0

            avg_confidence = conn.execute(
                "SELECT AVG(confidence) FROM decisions"
            ).fetchone()[0] or 0.0

            avg_timing = conn.execute(
                "SELECT AVG(timing_ms) FROM decisions"
            ).fetchone()[0] or 0.0

            outcome_count = conn.execute(
                "SELECT COUNT(*) FROM decision_outcomes"
            ).fetchone()[0]

            audit_count = conn.execute(
                "SELECT COUNT(*) FROM decision_audit"
            ).fetchone()[0]

            return {
                "total_decisions": total,
                "by_decision": by_decision,
                "by_sector": by_sector,
                "average_risk_score": round(avg_risk, 6),
                "average_confidence": round(avg_confidence, 4),
                "average_timing_ms": round(avg_timing, 2),
                "total_outcomes": outcome_count,
                "total_audit_records": audit_count,
            }
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Row → model converters
    # -------------------------------------------------------------------

    @staticmethod
    def _row_to_decision(row: sqlite3.Row) -> DecisionRecord:
        return DecisionRecord(
            id=row["id"],
            entity_id=row["entity_id"],
            entity_label=row["entity_label"] or "",
            portfolio_id=row["portfolio_id"],
            sector=row["sector"] or "",
            decision=row["decision"],
            risk_score=row["risk_score"],
            risk_level=row["risk_level"] or "",
            confidence=row["confidence"] or 0.0,
            pricing=json.loads(row["pricing"] or "{}"),
            coverage=json.loads(row["coverage"] or "{}"),
            conditions=json.loads(row["conditions"] or "[]"),
            macro_context=json.loads(row["macro_context"] or "{}"),
            graph_context=json.loads(row["graph_context"] or "{}"),
            portfolio_context=json.loads(row["portfolio_context"]) if row["portfolio_context"] else None,
            underwriting_context=json.loads(row["underwriting_context"] or "{}"),
            explanation=json.loads(row["explanation"] or "[]"),
            decision_summary=row["decision_summary"] or "",
            input_params=json.loads(row["input_params"] or "{}"),
            model_versions=json.loads(row["model_versions"] or "{}"),
            status=DecisionStatus(row["status"]) if row["status"] else DecisionStatus.ACTIVE,
            timing_ms=row["timing_ms"] or 0.0,
            created_at=row["created_at"],
        )

    @staticmethod
    def _row_to_audit(row: sqlite3.Row) -> AuditRecord:
        return AuditRecord(
            id=row["id"],
            decision_id=row["decision_id"],
            macro_hash=row["macro_hash"] or "",
            graph_hash=row["graph_hash"] or "",
            underwriting_hash=row["underwriting_hash"] or "",
            unified_hash=row["unified_hash"] or "",
            input_hash=row["input_hash"],
            output_hash=row["output_hash"],
            previous_hash=row["previous_hash"] or "",
            chain_hash=row["chain_hash"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _row_to_outcome(row: sqlite3.Row) -> OutcomeRecord:
        return OutcomeRecord(
            id=row["id"],
            decision_id=row["decision_id"],
            outcome=row["outcome"],
            severity=row["severity"] or 0.0,
            actual_loss_amount=row["actual_loss_amount"] or 0.0,
            notes=row["notes"] or "",
            observed_at=row["observed_at"],
        )


def get_audit_repository(db_path: str | Path | None = None) -> AuditRepository:
    """Singleton audit repository."""
    global _instance
    with _lock:
        if _instance is None:
            _instance = AuditRepository(db_path)
        return _instance
