"""Policy Engine — Repository (SQLite persistence).

Stores policies, rules, and version history.
PostgreSQL-compatible schema.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from src.core.policy.models import Policy, Rule, PolicyVersion, PolicyStatus

_instance: PolicyRepository | None = None
_lock = threading.Lock()
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "data" / "policies.db"


class PolicyRepository:
    """SQLite-backed policy storage."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self._db_path = str(db_path or _DEFAULT_DB_PATH)
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

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
                CREATE TABLE IF NOT EXISTS policies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT DEFAULT '',
                    description_ar TEXT DEFAULT '',
                    sector TEXT DEFAULT '*',
                    version INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS rules (
                    id TEXT PRIMARY KEY,
                    policy_id TEXT NOT NULL REFERENCES policies(id),
                    name TEXT DEFAULT '',
                    description TEXT DEFAULT '',
                    condition TEXT NOT NULL,
                    action TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    enabled INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS policy_versions (
                    id TEXT PRIMARY KEY,
                    policy_id TEXT NOT NULL REFERENCES policies(id),
                    version INTEGER NOT NULL,
                    changelog TEXT DEFAULT '',
                    snapshot TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_rules_policy
                    ON rules(policy_id);
                CREATE INDEX IF NOT EXISTS idx_policies_sector
                    ON policies(sector);
                CREATE INDEX IF NOT EXISTS idx_policies_status
                    ON policies(status);
                CREATE INDEX IF NOT EXISTS idx_versions_policy
                    ON policy_versions(policy_id);
            """)
            conn.commit()
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Policies
    # -------------------------------------------------------------------

    def save_policy(self, policy: Policy) -> str:
        conn = self._conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO policies
                   (id, name, description, description_ar, sector, version, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (policy.id, policy.name, policy.description, policy.description_ar,
                 policy.sector, policy.version, policy.status.value,
                 policy.created_at, policy.updated_at),
            )
            # Save rules
            for rule in policy.rules:
                rule.policy_id = policy.id
                conn.execute(
                    """INSERT OR REPLACE INTO rules
                       (id, policy_id, name, description, condition, action, priority, enabled, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (rule.id, rule.policy_id, rule.name, rule.description,
                     json.dumps(rule.condition), json.dumps(rule.action),
                     rule.priority, 1 if rule.enabled else 0, rule.created_at),
                )
            conn.commit()
            return policy.id
        finally:
            conn.close()

    def get_policy(self, policy_id: str) -> Policy | None:
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM policies WHERE id = ?", (policy_id,)).fetchone()
            if not row:
                return None
            rules = self._get_rules(conn, policy_id)
            return self._row_to_policy(row, rules)
        finally:
            conn.close()

    def get_policy_by_name(self, name: str) -> Policy | None:
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM policies WHERE name = ?", (name,)).fetchone()
            if not row:
                return None
            rules = self._get_rules(conn, row["id"])
            return self._row_to_policy(row, rules)
        finally:
            conn.close()

    def list_policies(
        self,
        sector: str | None = None,
        status: str | None = None,
    ) -> list[Policy]:
        conn = self._conn()
        try:
            query = "SELECT * FROM policies WHERE 1=1"
            params: list[Any] = []
            if sector:
                query += " AND (sector = ? OR sector = '*')"
                params.append(sector)
            if status:
                query += " AND status = ?"
                params.append(status)
            query += " ORDER BY name"
            rows = conn.execute(query, params).fetchall()
            policies = []
            for row in rows:
                rules = self._get_rules(conn, row["id"])
                policies.append(self._row_to_policy(row, rules))
            return policies
        finally:
            conn.close()

    def get_active_rules_for_sector(self, sector: str) -> list[Rule]:
        """Get all active rules applicable to a sector."""
        conn = self._conn()
        try:
            rows = conn.execute(
                """SELECT r.* FROM rules r
                   JOIN policies p ON r.policy_id = p.id
                   WHERE p.status = 'active'
                   AND (p.sector = ? OR p.sector = '*')
                   AND r.enabled = 1
                   ORDER BY r.priority DESC""",
                (sector,),
            ).fetchall()
            return [self._row_to_rule(r) for r in rows]
        finally:
            conn.close()

    def delete_policy(self, policy_id: str) -> bool:
        conn = self._conn()
        try:
            conn.execute("DELETE FROM rules WHERE policy_id = ?", (policy_id,))
            conn.execute("DELETE FROM policy_versions WHERE policy_id = ?", (policy_id,))
            cursor = conn.execute("DELETE FROM policies WHERE id = ?", (policy_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Rules
    # -------------------------------------------------------------------

    def add_rule(self, rule: Rule) -> str:
        conn = self._conn()
        try:
            conn.execute(
                """INSERT INTO rules
                   (id, policy_id, name, description, condition, action, priority, enabled, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (rule.id, rule.policy_id, rule.name, rule.description,
                 json.dumps(rule.condition), json.dumps(rule.action),
                 rule.priority, 1 if rule.enabled else 0, rule.created_at),
            )
            conn.commit()
            return rule.id
        finally:
            conn.close()

    def update_rule(self, rule_id: str, updates: dict[str, Any]) -> bool:
        conn = self._conn()
        try:
            sets = []
            params: list[Any] = []
            for key in ("name", "description", "priority", "enabled"):
                if key in updates:
                    sets.append(f"{key} = ?")
                    params.append(updates[key] if key != "enabled" else (1 if updates[key] else 0))
            if "condition" in updates:
                sets.append("condition = ?")
                params.append(json.dumps(updates["condition"]))
            if "action" in updates:
                sets.append("action = ?")
                params.append(json.dumps(updates["action"]))
            if not sets:
                return False
            params.append(rule_id)
            cursor = conn.execute(f"UPDATE rules SET {', '.join(sets)} WHERE id = ?", params)
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete_rule(self, rule_id: str) -> bool:
        conn = self._conn()
        try:
            cursor = conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Versioning
    # -------------------------------------------------------------------

    def create_version(self, policy_id: str, changelog: str) -> PolicyVersion | None:
        conn = self._conn()
        try:
            policy_row = conn.execute("SELECT * FROM policies WHERE id = ?", (policy_id,)).fetchone()
            if not policy_row:
                return None
            rules = self._get_rules(conn, policy_id)
            snapshot = json.dumps([r.to_dict() for r in rules])
            new_version = policy_row["version"] + 1

            pv = PolicyVersion(
                policy_id=policy_id,
                version=new_version,
                changelog=changelog,
                snapshot=snapshot,
            )
            conn.execute(
                """INSERT INTO policy_versions (id, policy_id, version, changelog, snapshot, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (pv.id, pv.policy_id, pv.version, pv.changelog, pv.snapshot, pv.created_at),
            )
            conn.execute(
                "UPDATE policies SET version = ?, updated_at = ? WHERE id = ?",
                (new_version, pv.created_at, policy_id),
            )
            conn.commit()
            return pv
        finally:
            conn.close()

    def get_versions(self, policy_id: str) -> list[PolicyVersion]:
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM policy_versions WHERE policy_id = ? ORDER BY version DESC",
                (policy_id,),
            ).fetchall()
            return [PolicyVersion(
                id=r["id"], policy_id=r["policy_id"], version=r["version"],
                changelog=r["changelog"], snapshot=r["snapshot"], created_at=r["created_at"],
            ) for r in rows]
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Statistics
    # -------------------------------------------------------------------

    def get_statistics(self) -> dict[str, Any]:
        conn = self._conn()
        try:
            total_policies = conn.execute("SELECT COUNT(*) FROM policies").fetchone()[0]
            active_policies = conn.execute("SELECT COUNT(*) FROM policies WHERE status='active'").fetchone()[0]
            total_rules = conn.execute("SELECT COUNT(*) FROM rules").fetchone()[0]
            enabled_rules = conn.execute("SELECT COUNT(*) FROM rules WHERE enabled=1").fetchone()[0]
            total_versions = conn.execute("SELECT COUNT(*) FROM policy_versions").fetchone()[0]
            return {
                "total_policies": total_policies,
                "active_policies": active_policies,
                "total_rules": total_rules,
                "enabled_rules": enabled_rules,
                "total_versions": total_versions,
            }
        finally:
            conn.close()

    # -------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------

    def _get_rules(self, conn: sqlite3.Connection, policy_id: str) -> list[Rule]:
        rows = conn.execute(
            "SELECT * FROM rules WHERE policy_id = ? ORDER BY priority DESC",
            (policy_id,),
        ).fetchall()
        return [self._row_to_rule(r) for r in rows]

    @staticmethod
    def _row_to_policy(row: sqlite3.Row, rules: list[Rule]) -> Policy:
        return Policy(
            id=row["id"], name=row["name"],
            description=row["description"] or "",
            description_ar=row["description_ar"] or "",
            sector=row["sector"] or "*",
            version=row["version"] or 1,
            status=PolicyStatus(row["status"]) if row["status"] else PolicyStatus.ACTIVE,
            rules=rules,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _row_to_rule(row: sqlite3.Row) -> Rule:
        return Rule(
            id=row["id"], policy_id=row["policy_id"],
            name=row["name"] or "",
            description=row["description"] or "",
            condition=json.loads(row["condition"]),
            action=json.loads(row["action"]),
            priority=row["priority"] or 0,
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
        )


def get_policy_repository(db_path: str | Path | None = None) -> PolicyRepository:
    global _instance
    with _lock:
        if _instance is None:
            _instance = PolicyRepository(db_path)
        return _instance
