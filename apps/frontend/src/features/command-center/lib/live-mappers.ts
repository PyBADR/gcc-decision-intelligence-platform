/**
 * Live Mappers — normalize backend RunResult into V2 UI-safe shapes.
 * Tolerates partial/missing fields. Never throws.
 */

import type { RunResult, DecisionAction, RunHeadline } from "@/types/observatory";
import type { GccEvent, Decision, ImpactMetric } from "@/lib/v2/types";

// ── Helpers ─────────────────────────────────────────────────────────

function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatUsd(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Derive event status from both the run status string AND headline metrics.
 * No hardcoded stable states — if headline data indicates stress, the status
 * reflects that regardless of what the status string says.
 */
function deriveEventStatus(
  status: string | undefined,
  headline: Partial<RunHeadline> | undefined
): GccEvent["status"] {
  const avgStress = safeNumber(headline?.average_stress, 0);
  const criticalCount = safeNumber(headline?.critical_count, 0);
  const totalLoss = safeNumber(headline?.total_loss_usd, 0);

  // If headline signals active danger, override any status string
  if (criticalCount > 0 || avgStress > 0.6 || totalLoss > 2e9) {
    return "active";
  }

  // If moderate stress detected, stay in monitoring
  if (avgStress > 0.3 || totalLoss > 5e8) {
    return "monitoring";
  }

  // Fall back to status string only when headline shows no stress
  if (status) {
    const s = status.toLowerCase();
    // Only resolve if data confirms low stress
    if ((s === "completed" || s === "nominal") && avgStress <= 0.3) {
      return "resolved";
    }
    // Any "running" variant stays active
    if (s === "running" || s === "in_progress" || s === "pending") {
      return "active";
    }
  }

  // No status string and no stress signals — monitoring by default
  return "monitoring";
}

/**
 * Compute severity from multiple headline signals, not just average_stress.
 * Weights: average_stress (40%), critical ratio (30%), loss magnitude (30%).
 */
function severityFromHeadline(headline: Partial<RunHeadline> | undefined): number {
  if (!headline) return 0;

  const avgStress = safeNumber(headline.average_stress, 0);
  const criticalCount = safeNumber(headline.critical_count, 0);
  const elevatedCount = safeNumber(headline.elevated_count, 0);
  const affectedEntities = safeNumber(headline.affected_entities, 1);
  const totalLoss = safeNumber(headline.total_loss_usd, 0);

  // Critical ratio: what fraction of affected entities are critical/elevated
  const criticalRatio = affectedEntities > 0
    ? Math.min(1, (criticalCount + elevatedCount * 0.5) / affectedEntities)
    : 0;

  // Loss magnitude: normalize against $5B as a "max expected" reference
  const lossMagnitude = Math.min(1, totalLoss / 5e9);

  // Weighted blend
  const severity = avgStress * 0.4 + criticalRatio * 0.3 + lossMagnitude * 0.3;

  return Math.min(1, Math.max(0, severity));
}

// ── Map RunResult → GccEvent ────────────────────────────────────────

export function mapRunResultToEvent(run: Partial<RunResult>): GccEvent {
  const scenario = run.scenario;
  return {
    id: safeString(run.run_id, "unknown"),
    name: safeString(scenario?.label, "Unnamed Scenario"),
    name_ar: safeString(scenario?.label_ar, "سيناريو غير مسمى"),
    severity: severityFromHeadline(run.headline),
    region: "GCC",
    timestamp: new Date().toISOString(),
    status: deriveEventStatus(run.status, run.headline),
  };
}

// ── Map RunResult → ImpactMetric[] ──────────────────────────────────

export function mapRunResultToMetrics(run: Partial<RunResult>): ImpactMetric[] {
  const h = run.headline;
  if (!h) return defaultMetrics();

  return [
    {
      label: "Total Exposure",
      value: formatUsd(safeNumber(h.total_loss_usd, 0)),
      delta: safeNumber(h.critical_count, 0) > 0 ? `${safeNumber(h.critical_count, 0)} critical` : "—",
      trend: safeNumber(h.total_loss_usd, 0) > 1e9 ? "up" : "flat",
    },
    {
      label: "Entities Affected",
      value: String(safeNumber(h.affected_entities, 0)),
      delta: safeNumber(h.elevated_count, 0) > 0 ? `+${safeNumber(h.elevated_count, 0)} elevated` : "—",
      trend: safeNumber(h.affected_entities, 0) > 10 ? "up" : "flat",
    },
    {
      label: "Peak Day",
      value: `Day ${safeNumber(h.peak_day, 0)}`,
      delta: `${safeNumber(h.max_recovery_days, 0)}d recovery`,
      trend: "flat",
    },
    {
      label: "Avg Stress",
      value: `${(safeNumber(h.average_stress, 0) * 100).toFixed(0)}%`,
      delta: safeNumber(h.average_stress, 0) > 0.6 ? "HIGH" : "OK",
      trend: safeNumber(h.average_stress, 0) > 0.6 ? "up" : "flat",
    },
  ];
}

function defaultMetrics(): ImpactMetric[] {
  return [
    { label: "Total Exposure", value: "—", delta: "—", trend: "flat" },
    { label: "Entities Affected", value: "—", delta: "—", trend: "flat" },
    { label: "Peak Day", value: "—", delta: "—", trend: "flat" },
    { label: "Avg Stress", value: "—", delta: "—", trend: "flat" },
  ];
}

// ── Map DecisionAction[] → Decision[] ───────────────────────────────

function mapPriority(priority: number): Decision["priority"] {
  if (priority >= 0.8) return "critical";
  if (priority >= 0.5) return "high";
  return "medium";
}

export function mapDecisionActions(actions: DecisionAction[] | undefined | null): Decision[] {
  if (!Array.isArray(actions) || actions.length === 0) return [];

  return actions.map((a) => {
    const lossAvoided = safeNumber(a.loss_avoided_usd, 0);
    const cost = safeNumber(a.cost_usd, 0);
    const netBenefit = lossAvoided - cost;
    const confidence = safeNumber(a.confidence, 0);

    return {
      id: safeString(a.id, `dec-${Math.random().toString(36).slice(2, 8)}`),
      title: safeString(a.action, "Unnamed Action"),
      title_ar: safeString(a.action_ar, "إجراء غير مسمى"),
      priority: mapPriority(safeNumber(a.priority, 0)),
      owner: safeString(a.owner, "Unassigned"),
      impact_usd: formatUsd(lossAvoided),
      cost_usd: formatUsd(cost),
      confidence: Math.min(1, Math.max(0, confidence)),
      deadline: new Date(
        Date.now() + safeNumber(a.time_to_act_hours, 72) * 3600_000
      ).toISOString(),
      status: "pending" as const,
      rationale: buildRationale(a),
      net_benefit_usd: formatUsd(Math.abs(netBenefit)),
      loss_inducing: netBenefit < 0,
    };
  });
}

function buildRationale(a: Partial<DecisionAction>): string {
  const parts: string[] = [];
  const urgency = safeNumber(a.urgency, -1);
  const regRisk = safeNumber(a.regulatory_risk, -1);
  const ttf = safeNumber(a.time_to_failure_hours, -1);
  const cost = safeNumber(a.cost_usd, -1);
  if (urgency >= 0) parts.push(`Urgency ${(urgency * 100).toFixed(0)}%`);
  if (regRisk >= 0) parts.push(`Reg-risk ${(regRisk * 100).toFixed(0)}%`);
  if (ttf >= 0) parts.push(`Failure in ${ttf.toFixed(0)}h`);
  if (cost >= 0) parts.push(`Cost ${formatUsd(cost)}`);
  return parts.length > 0
    ? parts.join(" · ")
    : "No additional context available.";
}

// ── Graph Safety ────────────────────────────────────────────────────

export interface SafeGraphNode {
  id: string;
  label: string;
  sector: string;
  stress: number;
  x?: number;
  y?: number;
}

export interface SafeGraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface SafeGraph {
  nodes: SafeGraphNode[];
  edges: SafeGraphEdge[];
  isEmpty: boolean;
  isDense: boolean;
  nodeCount: number;
  edgeCount: number;
}

const DENSE_THRESHOLD = 200;

export function mapPropagationToGraph(
  propagation: Record<string, unknown>[] | undefined | null,
  flowStates: Record<string, unknown>[] | undefined | null
): SafeGraph {
  const nodes: SafeGraphNode[] = [];
  const edges: SafeGraphEdge[] = [];
  const seen = new Set<string>();

  // Extract nodes from flow_states
  if (Array.isArray(flowStates)) {
    for (const state of flowStates) {
      if (state == null || typeof state !== "object") continue;
      const rec = state as Record<string, unknown>;
      const id = safeString(rec.entity_id, "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      nodes.push({
        id,
        label: safeString(rec.entity_label, id),
        sector: safeString(rec.sector, "unknown"),
        stress: safeNumber(rec.stress_level, 0),
      });
    }
  }

  // Extract edges from propagation
  if (Array.isArray(propagation)) {
    for (const step of propagation) {
      if (step == null || typeof step !== "object") continue;
      const rec = step as Record<string, unknown>;
      const source = safeString(rec.source_id ?? rec.from, "");
      const target = safeString(rec.target_id ?? rec.to, "");
      const weight = safeNumber(rec.weight ?? rec.impact, 0.5);
      if (source && target) {
        edges.push({ source, target, weight });
      }
    }
  }

  return {
    nodes,
    edges,
    isEmpty: nodes.length === 0,
    isDense: nodes.length > DENSE_THRESHOLD,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

// ── Full mapping entry point ────────────────────────────────────────

export interface MappedCommandCenterData {
  event: GccEvent;
  metrics: ImpactMetric[];
  decisions: Decision[];
  graph: SafeGraph;
  source: "live" | "mock";
}

export function mapRunResult(run: Partial<RunResult>, source: "live" | "mock"): MappedCommandCenterData {
  return {
    event: mapRunResultToEvent(run),
    metrics: mapRunResultToMetrics(run),
    decisions: mapDecisionActions(run.decisions?.actions),
    graph: mapPropagationToGraph(run.propagation, run.flow_states),
    source,
  };
}
