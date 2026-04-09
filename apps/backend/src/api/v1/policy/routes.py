"""Policy API — CRUD + evaluation endpoints.

Prefix: /api/v1/policy
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from src.core.policy.engine import get_policy_engine
from src.core.policy.registry import seed_default_policies
from src.api.v1.policy.schemas import (
    PolicyCreateRequest,
    PolicyUpdateRequest,
    PolicyResponse,
    PolicySummaryResponse,
    RuleCreateRequest,
    RuleUpdateRequest,
    RuleResponse,
    PolicyEvalRequest,
    PolicyEvalResponse,
    VersionCreateRequest,
    VersionResponse,
    PolicyStatsResponse,
    SeedResponse,
)

router = APIRouter(prefix="/policy", tags=["Policy Engine"])


# -------------------------------------------------------------------
# Policies CRUD
# -------------------------------------------------------------------

@router.get("/policies", response_model=list[PolicySummaryResponse])
async def list_policies(
    sector: str | None = Query(None, description="Filter by sector"),
    status: str | None = Query(None, description="Filter by status (active/draft/archived)"),
):
    """List all policies with optional filters."""
    engine = get_policy_engine()
    policies = engine.list_policies(sector=sector, status=status)
    return [
        PolicySummaryResponse(
            id=p.id, name=p.name, description=p.description,
            sector=p.sector, version=p.version, status=p.status.value,
            rule_count=len(p.rules), created_at=p.created_at, updated_at=p.updated_at,
        )
        for p in policies
    ]


@router.post("/policies", response_model=PolicyResponse, status_code=201)
async def create_policy(req: PolicyCreateRequest):
    """Create a new policy (starts in DRAFT status)."""
    engine = get_policy_engine()

    existing = engine.get_policy_by_name(req.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Policy '{req.name}' already exists")

    rules_data = [r.model_dump() for r in req.rules] if req.rules else None

    policy = engine.create_policy(
        name=req.name,
        description=req.description,
        description_ar=req.description_ar,
        sector=req.sector,
        rules=rules_data,
    )
    return _policy_to_response(policy)


@router.get("/policies/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: str):
    """Get a single policy with all rules."""
    engine = get_policy_engine()
    policy = engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.patch("/policies/{policy_id}", response_model=PolicyResponse)
async def update_policy(policy_id: str, req: PolicyUpdateRequest):
    """Update policy metadata."""
    engine = get_policy_engine()
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    policy = engine.update_policy(policy_id, updates)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.post("/policies/{policy_id}/activate", response_model=PolicyResponse)
async def activate_policy(policy_id: str):
    """Activate a policy (transitions from draft/archived to active)."""
    engine = get_policy_engine()
    policy = engine.activate_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.post("/policies/{policy_id}/archive", response_model=PolicyResponse)
async def archive_policy(policy_id: str):
    """Archive a policy (soft disable)."""
    engine = get_policy_engine()
    policy = engine.archive_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str):
    """Delete a policy and all its rules."""
    engine = get_policy_engine()
    deleted = engine.delete_policy(policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"deleted": True, "policy_id": policy_id}


# -------------------------------------------------------------------
# Rules CRUD
# -------------------------------------------------------------------

@router.post("/policies/{policy_id}/rules", response_model=RuleResponse, status_code=201)
async def add_rule(policy_id: str, req: RuleCreateRequest):
    """Add a rule to a policy."""
    engine = get_policy_engine()
    rule = engine.add_rule(
        policy_id=policy_id,
        name=req.name,
        condition=req.condition,
        action=req.action,
        description=req.description,
        priority=req.priority,
        enabled=req.enabled,
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Policy not found")
    return RuleResponse(
        id=rule.id, policy_id=rule.policy_id, name=rule.name,
        description=rule.description, condition=rule.condition,
        action=rule.action, priority=rule.priority, enabled=rule.enabled,
        created_at=rule.created_at,
    )


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: str, req: RuleUpdateRequest):
    """Update a rule."""
    engine = get_policy_engine()
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updated = engine.update_rule(rule_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"updated": True, "rule_id": rule_id}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a rule."""
    engine = get_policy_engine()
    deleted = engine.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"deleted": True, "rule_id": rule_id}


# -------------------------------------------------------------------
# Evaluation
# -------------------------------------------------------------------

@router.post("/evaluate", response_model=PolicyEvalResponse)
async def evaluate_policies(req: PolicyEvalRequest):
    """Evaluate all active policy rules against a context."""
    engine = get_policy_engine()
    result = engine.evaluate(req.context, sector=req.sector)
    return PolicyEvalResponse(**result)


# -------------------------------------------------------------------
# Versioning
# -------------------------------------------------------------------

@router.post("/policies/{policy_id}/versions", response_model=VersionResponse, status_code=201)
async def create_version(policy_id: str, req: VersionCreateRequest):
    """Create a new version snapshot of a policy."""
    engine = get_policy_engine()
    version = engine.create_version(policy_id, req.changelog)
    if not version:
        raise HTTPException(status_code=404, detail="Policy not found")
    return VersionResponse(
        id=version.id, policy_id=version.policy_id,
        version=version.version, changelog=version.changelog,
        created_at=version.created_at,
    )


@router.get("/policies/{policy_id}/versions", response_model=list[VersionResponse])
async def list_versions(policy_id: str):
    """List version history for a policy."""
    engine = get_policy_engine()
    versions = engine.get_versions(policy_id)
    return [
        VersionResponse(
            id=v.id, policy_id=v.policy_id,
            version=v.version, changelog=v.changelog,
            created_at=v.created_at,
        )
        for v in versions
    ]


# -------------------------------------------------------------------
# Statistics & Seed
# -------------------------------------------------------------------

@router.get("/statistics", response_model=PolicyStatsResponse)
async def get_statistics():
    """Get policy engine statistics."""
    engine = get_policy_engine()
    stats = engine.get_statistics()
    return PolicyStatsResponse(**stats)


@router.post("/seed", response_model=SeedResponse)
async def seed_policies():
    """Seed default GCC policies. Idempotent."""
    result = seed_default_policies()
    return SeedResponse(**result)


@router.get("/health")
async def policy_health():
    """Policy engine health check."""
    engine = get_policy_engine()
    stats = engine.get_statistics()
    return {
        "status": "healthy",
        "engine": "policy_engine_v1",
        "stats": stats,
    }


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _policy_to_response(policy) -> PolicyResponse:
    return PolicyResponse(
        id=policy.id,
        name=policy.name,
        description=policy.description,
        description_ar=policy.description_ar,
        sector=policy.sector,
        version=policy.version,
        status=policy.status.value,
        rule_count=len(policy.rules),
        rules=[
            RuleResponse(
                id=r.id, policy_id=r.policy_id, name=r.name,
                description=r.description, condition=r.condition,
                action=r.action, priority=r.priority, enabled=r.enabled,
                created_at=r.created_at,
            )
            for r in policy.rules
        ],
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )
