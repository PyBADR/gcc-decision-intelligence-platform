/**
 * Readiness Guards — validate payloads, detect empty states, gate unsafe actions.
 * Every function is pure, never throws.
 */

import type { RunResult } from "@/types/observatory";
import type { Decision } from "@/lib/v2/types";
import type { SafeGraph } from "./live-mappers";

// ── Payload Validation ──────────────────────────────────────────────

export interface PayloadDiagnostic {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0..1
}

export function validateRunResult(raw: unknown): PayloadDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fields = 0;
  const total = 8;

  if (raw == null || typeof raw !== "object") {
    return { valid: false, errors: ["Payload is null or not an object"], warnings: [], completeness: 0 };
  }

  const r = raw as Partial<RunResult>;

  if (r.run_id) fields++;
  else errors.push("Missing run_id");

  if (r.status) fields++;
  else warnings.push("Missing status field");

  if (r.scenario && typeof r.scenario === "object") fields++;
  else warnings.push("Missing scenario metadata");

  if (r.headline && typeof r.headline === "object") fields++;
  else warnings.push("Missing headline metrics");

  if (Array.isArray(r.financial) && r.financial.length > 0) fields++;
  else warnings.push("Missing or empty financial impacts");

  if (r.decisions && typeof r.decisions === "object" && Array.isArray((r.decisions as any).actions)) fields++;
  else warnings.push("Missing decision actions");

  if (r.banking && typeof r.banking === "object") fields++;
  else warnings.push("Missing banking stress data");

  if (r.explanation && typeof r.explanation === "object") fields++;
  else warnings.push("Missing explanation pack");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    completeness: fields / total,
  };
}

// ── Panel State Detection ───────────────────────────────────────────

export type PanelState = "loading" | "empty" | "error" | "ready";

export function detectPanelState(opts: {
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
}): PanelState {
  if (opts.isLoading) return "loading";
  if (opts.error) return "error";
  if (!opts.hasData) return "empty";
  return "ready";
}

// ── Graph Readiness ─────────────────────────────────────────────────

export interface GraphReadiness {
  canRender: boolean;
  reason: string;
  nodeCount: number;
  edgeCount: number;
  isDense: boolean;
  suggestedMaxNodes: number | null;
}

export function assessGraphReadiness(graph: SafeGraph): GraphReadiness {
  if (graph.isEmpty) {
    return {
      canRender: false,
      reason: "No graph data available",
      nodeCount: 0,
      edgeCount: 0,
      isDense: false,
      suggestedMaxNodes: null,
    };
  }

  if (graph.isDense) {
    return {
      canRender: true,
      reason: `Dense graph (${graph.nodeCount} nodes). Rendering top 100 by stress.`,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      isDense: true,
      suggestedMaxNodes: 100,
    };
  }

  return {
    canRender: true,
    reason: "Graph ready",
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
    isDense: false,
    suggestedMaxNodes: null,
  };
}

// ── Decision Action Safety ──────────────────────────────────────────

export type ActionMode = "execute" | "propose" | "review";

export interface ActionSafety {
  mode: ActionMode;
  reason: string;
  canExecute: boolean;
}

/**
 * Determine safe action mode for a decision.
 * Only allows "execute" if backend has confirmed the action path is safe.
 * Default: "review" mode — user can see but not trigger.
 */
export function assessActionSafety(
  decision: Decision,
  opts: {
    backendActionsConfirmed: boolean;
    liveMode: boolean;
  }
): ActionSafety {
  // Never allow execute in mock mode
  if (!opts.liveMode) {
    return {
      mode: "review",
      reason: "Mock mode — actions are view-only",
      canExecute: false,
    };
  }

  // Backend must explicitly confirm action path is safe
  if (!opts.backendActionsConfirmed) {
    return {
      mode: "propose",
      reason: "Action endpoint not confirmed — propose only",
      canExecute: false,
    };
  }

  // Critical decisions require extra gate
  if (decision.priority === "critical") {
    return {
      mode: "propose",
      reason: "Critical actions require manual confirmation flow",
      canExecute: false,
    };
  }

  return {
    mode: "execute",
    reason: "Action path confirmed safe",
    canExecute: true,
  };
}

// ── Overall Readiness Verdict ───────────────────────────────────────

export interface ReadinessVerdict {
  ready: boolean;
  score: number; // 0..100
  checks: { name: string; passed: boolean; detail: string }[];
}

export function computeReadiness(opts: {
  payloadDiag: PayloadDiagnostic;
  graphReady: GraphReadiness;
  decisionsCount: number;
  source: "live" | "mock";
}): ReadinessVerdict {
  const checks = [
    {
      name: "Payload valid",
      passed: opts.payloadDiag.valid,
      detail: opts.payloadDiag.valid
        ? `${(opts.payloadDiag.completeness * 100).toFixed(0)}% complete`
        : opts.payloadDiag.errors.join("; "),
    },
    {
      name: "Headline metrics",
      passed: opts.payloadDiag.completeness >= 0.5,
      detail: `${(opts.payloadDiag.completeness * 100).toFixed(0)}% fields present`,
    },
    {
      name: "Graph renderable",
      passed: opts.graphReady.canRender,
      detail: opts.graphReady.reason,
    },
    {
      name: "Decisions available",
      passed: opts.decisionsCount > 0,
      detail: `${opts.decisionsCount} decision(s) queued`,
    },
    {
      name: "Data source",
      passed: true,
      detail: opts.source === "live" ? "Live backend" : "Mock data",
    },
  ];

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    ready: opts.payloadDiag.valid && passed >= 3,
    score,
    checks,
  };
}
