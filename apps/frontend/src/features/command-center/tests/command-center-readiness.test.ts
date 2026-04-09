/**
 * Command Center Readiness Tests
 *
 * Tests: payload normalization, mock fallback, partial payloads,
 * empty graph, decision action safety, and load path integrity.
 *
 * Run: npx vitest run src/features/command-center/tests/
 * (or jest — these are pure-function tests, framework-agnostic)
 */

import { describe, it, expect } from "vitest";
import {
  mapRunResultToEvent,
  mapRunResultToMetrics,
  mapDecisionActions,
  mapPropagationToGraph,
  mapRunResult,
} from "../lib/live-mappers";
import {
  validateRunResult,
  detectPanelState,
  assessGraphReadiness,
  assessActionSafety,
  computeReadiness,
} from "../lib/readiness-guards";
import { MOCK_EVENT, MOCK_DECISIONS, MOCK_METRICS } from "@/lib/v2/mock-data";
import type { RunResult, DecisionAction } from "@/types/observatory";

// ────────────────────────────────────────────────────────────────────
// 1. Live Payload Normalization
// ────────────────────────────────────────────────────────────────────

describe("Live payload normalization", () => {
  const fullPayload: Partial<RunResult> = {
    run_id: "run-123",
    status: "completed",
    scenario: {
      template_id: "hormuz",
      label: "Hormuz Closure",
      label_ar: "إغلاق هرمز",
      severity: 0.8,
      horizon_hours: 336,
    },
    headline: {
      total_loss_usd: 3_200_000_000,
      peak_day: 5,
      max_recovery_days: 42,
      average_stress: 0.72,
      affected_entities: 24,
      critical_count: 3,
      elevated_count: 8,
    },
    decisions: {
      run_id: "run-123",
      scenario_label: "Hormuz",
      total_loss_usd: 3_200_000_000,
      peak_day: 5,
      time_to_failure_hours: 48,
      actions: [
        {
          id: "a1",
          action: "Activate liquidity facility",
          action_ar: "تفعيل السيولة",
          sector: "banking",
          owner: "Treasury",
          urgency: 0.9,
          value: 0.8,
          regulatory_risk: 0.3,
          priority: 0.85,
          time_to_act_hours: 12,
          time_to_failure_hours: 48,
          loss_avoided_usd: 1_200_000_000,
          cost_usd: 50_000_000,
          confidence: 0.9,
        },
      ],
      all_actions: [],
    },
  };

  it("maps a full RunResult to GccEvent", () => {
    const event = mapRunResultToEvent(fullPayload);
    expect(event.id).toBe("run-123");
    expect(event.name).toBe("Hormuz Closure");
    expect(event.name_ar).toBe("إغلاق هرمز");
    expect(event.status).toBe("active"); // headline stress 0.72 + 3 critical overrides "completed"
  });

  it("maps headline to ImpactMetric[]", () => {
    const metrics = mapRunResultToMetrics(fullPayload);
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe("$3.2B");
    expect(metrics[1].value).toBe("24");
  });

  it("maps DecisionActions to Decision[]", () => {
    const decisions = mapDecisionActions(fullPayload.decisions?.actions);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].title).toBe("Activate liquidity facility");
    expect(decisions[0].priority).toBe("critical"); // priority 0.85 >= 0.8
    expect(decisions[0].impact_usd).toBe("$1.2B");
    expect(decisions[0].cost_usd).toBe("$50M");
    expect(decisions[0].confidence).toBe(0.9);
    expect(decisions[0].net_benefit_usd).toBe("$1.1B"); // $1.2B - $50M = $1.15B → rounds to $1.1B
    expect(decisions[0].loss_inducing).toBe(false);
  });

  it("full mapRunResult produces complete MappedCommandCenterData", () => {
    const mapped = mapRunResult(fullPayload, "live");
    expect(mapped.source).toBe("live");
    expect(mapped.event.id).toBe("run-123");
    expect(mapped.metrics).toHaveLength(4);
    expect(mapped.decisions).toHaveLength(1);
    expect(mapped.graph.isEmpty).toBe(true); // no propagation data in fixture
  });
});

// ────────────────────────────────────────────────────────────────────
// 1b. Status Calibration
// ────────────────────────────────────────────────────────────────────

describe("Status calibration", () => {
  it("high stress overrides completed status to active", () => {
    const event = mapRunResultToEvent({
      run_id: "r1",
      status: "completed",
      headline: { total_loss_usd: 4e9, average_stress: 0.8, critical_count: 5, elevated_count: 2, affected_entities: 20, peak_day: 3, max_recovery_days: 30 },
    });
    expect(event.status).toBe("active");
  });

  it("moderate stress keeps monitoring even if status is completed", () => {
    const event = mapRunResultToEvent({
      run_id: "r2",
      status: "completed",
      headline: { total_loss_usd: 8e8, average_stress: 0.4, critical_count: 0, elevated_count: 1, affected_entities: 10, peak_day: 2, max_recovery_days: 14 },
    });
    expect(event.status).toBe("monitoring");
  });

  it("low stress + completed = resolved", () => {
    const event = mapRunResultToEvent({
      run_id: "r3",
      status: "completed",
      headline: { total_loss_usd: 1e7, average_stress: 0.1, critical_count: 0, elevated_count: 0, affected_entities: 3, peak_day: 1, max_recovery_days: 5 },
    });
    expect(event.status).toBe("resolved");
  });

  it("running status maps to active regardless of stress", () => {
    const event = mapRunResultToEvent({
      run_id: "r4",
      status: "running",
      headline: { total_loss_usd: 0, average_stress: 0.05, critical_count: 0, elevated_count: 0, affected_entities: 0, peak_day: 0, max_recovery_days: 0 },
    });
    expect(event.status).toBe("active");
  });

  it("no status and no headline = monitoring", () => {
    const event = mapRunResultToEvent({});
    expect(event.status).toBe("monitoring");
  });

  it("severity blends stress, critical ratio, and loss magnitude", () => {
    const event = mapRunResultToEvent({
      run_id: "r5",
      headline: { total_loss_usd: 2.5e9, average_stress: 0.6, critical_count: 4, elevated_count: 6, affected_entities: 20, peak_day: 4, max_recovery_days: 28 },
    });
    // stress=0.6*0.4=0.24, critRatio=(4+3)/20=0.35*0.3=0.105, loss=0.5*0.3=0.15 → ~0.495
    expect(event.severity).toBeGreaterThan(0.4);
    expect(event.severity).toBeLessThan(0.7);
  });

  it("severity is 0 when no headline", () => {
    const event = mapRunResultToEvent({ run_id: "r6" });
    expect(event.severity).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 1c. Loss-Inducing Action Detection
// ────────────────────────────────────────────────────────────────────

describe("Loss-inducing action detection", () => {
  it("flags loss-inducing when cost exceeds loss avoided", () => {
    const actions: DecisionAction[] = [{
      id: "bad-1",
      action: "Expensive hedge",
      action_ar: null,
      sector: "banking",
      owner: "Treasury",
      urgency: 0.5,
      value: 0.3,
      regulatory_risk: 0.2,
      priority: 0.5,
      time_to_act_hours: 24,
      time_to_failure_hours: 72,
      loss_avoided_usd: 100_000,
      cost_usd: 500_000,
      confidence: 0.4,
    }];
    const decisions = mapDecisionActions(actions);
    expect(decisions[0].loss_inducing).toBe(true);
    expect(decisions[0].confidence).toBe(0.4);
  });

  it("does not flag when benefit exceeds cost", () => {
    const actions: DecisionAction[] = [{
      id: "good-1",
      action: "Good action",
      action_ar: null,
      sector: "banking",
      owner: "Ops",
      urgency: 0.8,
      value: 0.9,
      regulatory_risk: 0.1,
      priority: 0.8,
      time_to_act_hours: 6,
      time_to_failure_hours: 24,
      loss_avoided_usd: 1_000_000_000,
      cost_usd: 10_000_000,
      confidence: 0.95,
    }];
    const decisions = mapDecisionActions(actions);
    expect(decisions[0].loss_inducing).toBe(false);
    expect(decisions[0].confidence).toBe(0.95);
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Mock Fallback When Live Fails
// ────────────────────────────────────────────────────────────────────

describe("Mock fallback integrity", () => {
  it("mock data objects are well-formed", () => {
    expect(MOCK_EVENT.id).toBeTruthy();
    expect(MOCK_EVENT.name).toBeTruthy();
    expect(MOCK_EVENT.severity).toBeGreaterThan(0);
    expect(MOCK_DECISIONS.length).toBeGreaterThan(0);
    expect(MOCK_METRICS.length).toBe(4);
  });

  it("mock decisions have all required fields", () => {
    for (const d of MOCK_DECISIONS) {
      expect(d.id).toBeTruthy();
      expect(d.title).toBeTruthy();
      expect(["critical", "high", "medium"]).toContain(d.priority);
      expect(["pending", "in_progress", "executed"]).toContain(d.status);
      expect(d.owner).toBeTruthy();
      expect(d.rationale).toBeTruthy();
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Partial Payload Handling
// ────────────────────────────────────────────────────────────────────

describe("Partial payload handling", () => {
  it("handles completely empty object", () => {
    const event = mapRunResultToEvent({});
    expect(event.id).toBe("unknown");
    expect(event.name).toBe("Unnamed Scenario");
    expect(event.status).toBe("monitoring");
  });

  it("handles null input to validateRunResult", () => {
    const diag = validateRunResult(null);
    expect(diag.valid).toBe(false);
    expect(diag.completeness).toBe(0);
  });

  it("handles missing headline", () => {
    const metrics = mapRunResultToMetrics({});
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe("—"); // default fallback
  });

  it("handles missing/null decision actions", () => {
    expect(mapDecisionActions(null)).toEqual([]);
    expect(mapDecisionActions(undefined)).toEqual([]);
    expect(mapDecisionActions([])).toEqual([]);
  });

  it("validates partial payload with only run_id", () => {
    const diag = validateRunResult({ run_id: "partial-123" });
    expect(diag.valid).toBe(true); // run_id present → no errors
    expect(diag.completeness).toBeLessThan(1);
    expect(diag.warnings.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Empty Graph State
// ────────────────────────────────────────────────────────────────────

describe("Empty graph state", () => {
  it("detects empty graph from null inputs", () => {
    const graph = mapPropagationToGraph(null, null);
    expect(graph.isEmpty).toBe(true);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("detects empty graph from empty arrays", () => {
    const graph = mapPropagationToGraph([], []);
    expect(graph.isEmpty).toBe(true);
  });

  it("assessGraphReadiness blocks render on empty graph", () => {
    const graph = mapPropagationToGraph(null, null);
    const readiness = assessGraphReadiness(graph);
    expect(readiness.canRender).toBe(false);
    expect(readiness.reason).toContain("No graph");
  });

  it("handles dense graph (>200 nodes)", () => {
    const manyStates = Array.from({ length: 250 }, (_, i) => ({
      entity_id: `e-${i}`,
      entity_label: `Entity ${i}`,
      sector: "banking",
      stress_level: Math.random(),
    }));
    const graph = mapPropagationToGraph([], manyStates);
    expect(graph.isDense).toBe(true);
    expect(graph.nodeCount).toBe(250);
    const readiness = assessGraphReadiness(graph);
    expect(readiness.canRender).toBe(true);
    expect(readiness.isDense).toBe(true);
    expect(readiness.suggestedMaxNodes).toBe(100);
  });

  it("handles malformed propagation entries", () => {
    const badData = [
      { no_source: true, no_target: true },
      { source_id: "", target_id: "" },
      null,
      42,
      "not an object",
    ] as any[];
    const graph = mapPropagationToGraph(badData, []);
    expect(graph.isEmpty).toBe(true); // no valid nodes
    expect(graph.edges).toHaveLength(0); // no valid edges
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Decision Action Safety Downgrade
// ────────────────────────────────────────────────────────────────────

describe("Decision action safety", () => {
  const mockDecision = MOCK_DECISIONS[0]; // critical priority

  it("defaults to review mode in mock mode", () => {
    const safety = assessActionSafety(mockDecision, {
      backendActionsConfirmed: false,
      liveMode: false,
    });
    expect(safety.mode).toBe("review");
    expect(safety.canExecute).toBe(false);
  });

  it("downgrades to propose when backend not confirmed", () => {
    const safety = assessActionSafety(mockDecision, {
      backendActionsConfirmed: false,
      liveMode: true,
    });
    expect(safety.mode).toBe("propose");
    expect(safety.canExecute).toBe(false);
  });

  it("downgrades critical actions even when backend confirmed", () => {
    const safety = assessActionSafety(mockDecision, {
      backendActionsConfirmed: true,
      liveMode: true,
    });
    // Critical decisions always require manual confirmation
    expect(safety.mode).toBe("propose");
    expect(safety.canExecute).toBe(false);
  });

  it("allows execute only for non-critical with confirmed backend", () => {
    const mediumDecision = { ...MOCK_DECISIONS[2], priority: "medium" as const };
    const safety = assessActionSafety(mediumDecision, {
      backendActionsConfirmed: true,
      liveMode: true,
    });
    expect(safety.mode).toBe("execute");
    expect(safety.canExecute).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// 6. Command Center Load Path (no regression)
// ────────────────────────────────────────────────────────────────────

describe("Command center load path", () => {
  it("detectPanelState: loading takes priority", () => {
    expect(detectPanelState({ isLoading: true, error: "some error", hasData: true })).toBe("loading");
  });

  it("detectPanelState: error when not loading", () => {
    expect(detectPanelState({ isLoading: false, error: "fail", hasData: false })).toBe("error");
  });

  it("detectPanelState: empty when no data", () => {
    expect(detectPanelState({ isLoading: false, error: null, hasData: false })).toBe("empty");
  });

  it("detectPanelState: ready when data present", () => {
    expect(detectPanelState({ isLoading: false, error: null, hasData: true })).toBe("ready");
  });

  it("computeReadiness produces valid verdict for mock data", () => {
    const diag = validateRunResult({ run_id: "mock" });
    const graphReady = assessGraphReadiness({ nodes: [], edges: [], isEmpty: true, isDense: false, nodeCount: 0, edgeCount: 0 });
    const verdict = computeReadiness({
      payloadDiag: diag,
      graphReady,
      decisionsCount: 3,
      source: "mock",
    });
    expect(verdict.score).toBeGreaterThan(0);
    expect(verdict.checks.length).toBe(5);
  });

  it("computeReadiness fails on invalid payload", () => {
    const diag = validateRunResult(null);
    const graphReady = assessGraphReadiness({ nodes: [], edges: [], isEmpty: true, isDense: false, nodeCount: 0, edgeCount: 0 });
    const verdict = computeReadiness({
      payloadDiag: diag,
      graphReady,
      decisionsCount: 0,
      source: "live",
    });
    expect(verdict.ready).toBe(false);
    expect(verdict.score).toBeLessThan(50);
  });
});
