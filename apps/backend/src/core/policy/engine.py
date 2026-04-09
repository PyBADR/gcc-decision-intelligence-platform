"""Policy Engine — Orchestrator.

Combines PolicyRepository + PolicyEvaluator into a single high-level API.
Thread-safe singleton via get_policy_engine().
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from src.core.policy.models import Policy, Rule, PolicyVersion, PolicyStatus, RuleAction
from src.core.policy.evaluator import PolicyEvaluator, get_evaluator
from src.core.policy.repository import PolicyRepository, get_policy_repository

logger = logging.getLogger("observatory.policy")

_instance: PolicyEngine | None = None
_lock = threading.Lock()


class PolicyEngine:
    """High-level policy orchestrator."""

    def __init__(
        self,
        repository: PolicyRepository | None = None,
        evaluator: PolicyEvaluator | None = None,
    ) -> None:
        self._repo = repository or get_policy_repository()
        self._evaluator = evaluator or get_evaluator()

    # -------------------------------------------------------------------
    # Core evaluation
    # -------------------------------------------------------------------

    def evaluate(
        self,
        context: dict[str, Any],
        sector: str = "*",
    ) -> dict[str, Any]:
        """Evaluate all active policy rules against a decision context.

        Args:
            context: Decision context (macro, portfolio, underwriting data).
            sector: Sector scope for rule filtering.

        Returns:
            Merged policy result dict with decision overrides, pricing
            adjustments, coverage caps, conditions, risk adjustments.
        """
        rules = self._repo.get_active_rules_for_sector(sector)
        if not rules:
            return {
                "applied": False,
                "rules_matched": 0,
                "sector": sector,
            }

        matched_actions = self._evaluator.evaluate(context, rules)
        result = self._evaluator.merge_actions(matched_actions)
        result["sector"] = sector
        result["total_rules_evaluated"] = len(rules)

        logger.info(
            f"POLICY_ENGINE: sector={sector} evaluated={len(rules)} "
            f"matched={result.get('rules_matched', 0)}"
        )

        return result

    def evaluate_with_details(
        self,
        context: dict[str, Any],
        sector: str = "*",
    ) -> dict[str, Any]:
        """Evaluate with full context echo for debugging/audit."""
        result = self.evaluate(context, sector)
        result["context_keys"] = list(context.keys())
        return result

    # -------------------------------------------------------------------
    # Policy CRUD
    # -------------------------------------------------------------------

    def create_policy(
        self,
        name: str,
        description: str = "",
        description_ar: str = "",
        sector: str = "*",
        rules: list[dict[str, Any]] | None = None,
    ) -> Policy:
        """Create a new policy with optional initial rules."""
        policy = Policy(
            name=name,
            description=description,
            description_ar=description_ar,
            sector=sector,
            status=PolicyStatus.DRAFT,
        )

        if rules:
            for rule_data in rules:
                rule = Rule(
                    policy_id=policy.id,
                    name=rule_data.get("name", ""),
                    description=rule_data.get("description", ""),
                    condition=rule_data.get("condition", {}),
                    action=rule_data.get("action", {}),
                    priority=rule_data.get("priority", 0),
                    enabled=rule_data.get("enabled", True),
                )
                policy.rules.append(rule)

        self._repo.save_policy(policy)
        logger.info(f"POLICY_CREATED: id={policy.id} name={name} rules={len(policy.rules)}")
        return policy

    def get_policy(self, policy_id: str) -> Policy | None:
        return self._repo.get_policy(policy_id)

    def get_policy_by_name(self, name: str) -> Policy | None:
        return self._repo.get_policy_by_name(name)

    def list_policies(
        self,
        sector: str | None = None,
        status: str | None = None,
    ) -> list[Policy]:
        return self._repo.list_policies(sector=sector, status=status)

    def update_policy(
        self,
        policy_id: str,
        updates: dict[str, Any],
    ) -> Policy | None:
        """Update policy metadata (name, description, sector, status)."""
        policy = self._repo.get_policy(policy_id)
        if not policy:
            return None

        if "name" in updates:
            policy.name = updates["name"]
        if "description" in updates:
            policy.description = updates["description"]
        if "description_ar" in updates:
            policy.description_ar = updates["description_ar"]
        if "sector" in updates:
            policy.sector = updates["sector"]
        if "status" in updates:
            policy.status = PolicyStatus(updates["status"])

        from datetime import datetime, timezone
        policy.updated_at = datetime.now(timezone.utc).isoformat()

        self._repo.save_policy(policy)
        logger.info(f"POLICY_UPDATED: id={policy_id}")
        return policy

    def activate_policy(self, policy_id: str) -> Policy | None:
        return self.update_policy(policy_id, {"status": "active"})

    def archive_policy(self, policy_id: str) -> Policy | None:
        return self.update_policy(policy_id, {"status": "archived"})

    def delete_policy(self, policy_id: str) -> bool:
        deleted = self._repo.delete_policy(policy_id)
        if deleted:
            logger.info(f"POLICY_DELETED: id={policy_id}")
        return deleted

    # -------------------------------------------------------------------
    # Rule CRUD
    # -------------------------------------------------------------------

    def add_rule(
        self,
        policy_id: str,
        name: str,
        condition: dict[str, Any],
        action: dict[str, Any],
        description: str = "",
        priority: int = 0,
        enabled: bool = True,
    ) -> Rule | None:
        """Add a rule to an existing policy."""
        policy = self._repo.get_policy(policy_id)
        if not policy:
            return None

        rule = Rule(
            policy_id=policy_id,
            name=name,
            description=description,
            condition=condition,
            action=action,
            priority=priority,
            enabled=enabled,
        )
        self._repo.add_rule(rule)
        logger.info(f"RULE_ADDED: id={rule.id} policy={policy_id} name={name}")
        return rule

    def update_rule(self, rule_id: str, updates: dict[str, Any]) -> bool:
        updated = self._repo.update_rule(rule_id, updates)
        if updated:
            logger.info(f"RULE_UPDATED: id={rule_id}")
        return updated

    def delete_rule(self, rule_id: str) -> bool:
        deleted = self._repo.delete_rule(rule_id)
        if deleted:
            logger.info(f"RULE_DELETED: id={rule_id}")
        return deleted

    # -------------------------------------------------------------------
    # Versioning
    # -------------------------------------------------------------------

    def create_version(self, policy_id: str, changelog: str) -> PolicyVersion | None:
        version = self._repo.create_version(policy_id, changelog)
        if version:
            logger.info(
                f"POLICY_VERSION: id={version.id} policy={policy_id} v={version.version}"
            )
        return version

    def get_versions(self, policy_id: str) -> list[PolicyVersion]:
        return self._repo.get_versions(policy_id)

    # -------------------------------------------------------------------
    # Statistics
    # -------------------------------------------------------------------

    def get_statistics(self) -> dict[str, Any]:
        return self._repo.get_statistics()


def get_policy_engine(
    repository: PolicyRepository | None = None,
    evaluator: PolicyEvaluator | None = None,
) -> PolicyEngine:
    """Singleton PolicyEngine."""
    global _instance
    with _lock:
        if _instance is None:
            _instance = PolicyEngine(repository, evaluator)
        return _instance
