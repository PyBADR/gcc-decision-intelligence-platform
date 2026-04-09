"""Policy Engine — Rule Evaluator.

Evaluates rules against a decision context using dot-path resolution
and multi-operator condition matching.

Operators:
  eq (default)  — exact match
  gt, gte       — greater than / greater or equal
  lt, lte       — less than / less or equal
  ne            — not equal
  in            — value in list
  not_in        — value not in list
  contains      — string contains
  exists        — key exists in context

Deterministic — same context + rules always produce same result.
"""

from __future__ import annotations

import logging
from typing import Any

from src.core.policy.models import Rule, RuleAction

logger = logging.getLogger("observatory.policy")

_instance: PolicyEvaluator | None = None


class PolicyEvaluator:
    """Evaluates policy rules against decision context."""

    def evaluate(
        self,
        context: dict[str, Any],
        rules: list[Rule],
    ) -> list[RuleAction]:
        """Evaluate all rules against context.

        Rules are evaluated in priority order (highest first).
        Returns list of matched RuleActions.
        """
        # Sort by priority descending
        sorted_rules = sorted(rules, key=lambda r: -r.priority)

        matched: list[RuleAction] = []
        for rule in sorted_rules:
            if not rule.enabled:
                continue
            if self._match_condition(rule.condition, context):
                action = self._resolve_action(rule)
                matched.append(action)
                logger.info(
                    f"POLICY_MATCH: rule={rule.name} priority={rule.priority}"
                )

        return matched

    def merge_actions(
        self,
        actions: list[RuleAction],
    ) -> dict[str, Any]:
        """Merge multiple matched actions into a single policy result.

        Merge strategy:
          - decision: most restrictive wins (REJECTED > CONDITIONAL > APPROVED)
          - pricing: additive accumulation
          - coverage: minimum cap
          - conditions: union of all
          - risk: additive accumulation
          - block: any block = blocked
        """
        if not actions:
            return {
                "applied": False,
                "rules_matched": 0,
            }

        decision_priority = {"REJECTED": 3, "CONDITIONAL": 2, "APPROVED": 1}
        final_decision: str | None = None
        total_pricing_adj: float = 0.0
        min_coverage_cap: float = 1.0
        all_conditions: list[str] = []
        total_risk_adj: float = 0.0
        blocked = False
        reasons: list[dict[str, Any]] = []

        for action in actions:
            reasons.append(action.to_dict())

            if action.block:
                blocked = True
                final_decision = "REJECTED"

            if action.decision_override:
                if final_decision is None:
                    final_decision = action.decision_override
                else:
                    # Most restrictive wins
                    curr_pri = decision_priority.get(final_decision, 0)
                    new_pri = decision_priority.get(action.decision_override, 0)
                    if new_pri > curr_pri:
                        final_decision = action.decision_override

            if action.pricing_adjustment is not None:
                total_pricing_adj += action.pricing_adjustment

            if action.coverage_cap_pct is not None:
                min_coverage_cap = min(min_coverage_cap, action.coverage_cap_pct)

            if action.conditions_add:
                all_conditions.extend(action.conditions_add)

            if action.risk_adjustment is not None:
                total_risk_adj += action.risk_adjustment

        result: dict[str, Any] = {
            "applied": True,
            "rules_matched": len(actions),
            "blocked": blocked,
            "matched_rules": reasons,
        }

        if final_decision:
            result["decision_override"] = final_decision
        if total_pricing_adj != 0.0:
            result["pricing_adjustment"] = round(total_pricing_adj, 4)
        if min_coverage_cap < 1.0:
            result["coverage_cap_pct"] = round(min_coverage_cap, 4)
        if all_conditions:
            result["conditions_add"] = list(dict.fromkeys(all_conditions))  # dedup
        if total_risk_adj != 0.0:
            result["risk_adjustment"] = round(total_risk_adj, 4)

        return result

    # -------------------------------------------------------------------
    # Condition matching
    # -------------------------------------------------------------------

    def _match_condition(
        self,
        condition: dict[str, Any],
        context: dict[str, Any],
    ) -> bool:
        """Match all condition clauses against context."""
        if not condition:
            return True  # Empty condition = always matches

        for key, expected in condition.items():
            actual = self._resolve_path(context, key)
            if actual is None:
                # Key not found — condition fails
                if isinstance(expected, dict) and "exists" in expected:
                    if expected["exists"] is False:
                        continue  # exists=false and key missing → passes
                return False

            if not self._match_value(actual, expected):
                return False

        return True

    def _match_value(self, actual: Any, expected: Any) -> bool:
        """Match a single value against an expectation."""
        if isinstance(expected, dict):
            # Operator-based matching
            for op, val in expected.items():
                if not self._apply_operator(actual, op, val):
                    return False
            return True
        else:
            # Direct equality
            return actual == expected

    def _apply_operator(self, actual: Any, op: str, val: Any) -> bool:
        """Apply a comparison operator."""
        try:
            if op == "eq":
                return actual == val
            elif op == "ne":
                return actual != val
            elif op == "gt":
                return float(actual) > float(val)
            elif op == "gte":
                return float(actual) >= float(val)
            elif op == "lt":
                return float(actual) < float(val)
            elif op == "lte":
                return float(actual) <= float(val)
            elif op == "in":
                return actual in val
            elif op == "not_in":
                return actual not in val
            elif op == "contains":
                return str(val) in str(actual)
            elif op == "exists":
                return (actual is not None) == bool(val)
            else:
                logger.warning(f"Unknown operator: {op}")
                return False
        except (TypeError, ValueError):
            return False

    def _resolve_path(self, data: dict[str, Any], path: str) -> Any:
        """Resolve a dot-separated path in nested dict.

        Examples:
          "macro.regime" → data["macro"]["regime"]
          "decision.risk_score" → data["decision"]["risk_score"]
        """
        parts = path.split(".")
        current: Any = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
            if current is None:
                return None
        return current

    # -------------------------------------------------------------------
    # Action resolution
    # -------------------------------------------------------------------

    def _resolve_action(self, rule: Rule) -> RuleAction:
        """Convert a rule's action dict to a typed RuleAction."""
        action = rule.action
        return RuleAction(
            rule_id=rule.id,
            rule_name=rule.name,
            decision_override=action.get("decision"),
            pricing_adjustment=action.get("pricing_adjustment"),
            coverage_cap_pct=action.get("coverage_cap_pct"),
            conditions_add=action.get("conditions", []),
            risk_adjustment=action.get("risk_adjustment"),
            block=action.get("block", False),
            reason=action.get("reason", rule.description or rule.name),
        )


def get_evaluator() -> PolicyEvaluator:
    """Singleton evaluator."""
    global _instance
    if _instance is None:
        _instance = PolicyEvaluator()
    return _instance
