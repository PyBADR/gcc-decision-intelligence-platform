"use client";

/**
 * useCommandCenter — single hook that manages mock/live data switching,
 * normalization, and readiness state for the command center page.
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { mapRunResult, type MappedCommandCenterData } from "./live-mappers";
import {
  validateRunResult,
  assessGraphReadiness,
  computeReadiness,
  type ReadinessVerdict,
  type PayloadDiagnostic,
} from "./readiness-guards";
import { MOCK_EVENT, MOCK_DECISIONS, MOCK_METRICS } from "@/lib/v2/mock-data";
import type { SafeGraph } from "./live-mappers";

// ── Types ───────────────────────────────────────────────────────────

export type DataSource = "mock" | "live";

export interface CommandCenterState {
  /** Resolved data for all panels */
  data: MappedCommandCenterData;
  /** Current data source */
  source: DataSource;
  /** Is a live fetch in flight? */
  isLoading: boolean;
  /** Human-readable error if live fetch failed */
  error: string | null;
  /** Payload diagnostic from the last live payload */
  diagnostic: PayloadDiagnostic | null;
  /** Overall readiness verdict */
  readiness: ReadinessVerdict;
  /** Whether backend action endpoints are confirmed safe */
  backendActionsConfirmed: boolean;
  /** Switch between mock and live */
  setSource: (s: DataSource) => void;
  /** Trigger a live fetch for a given run ID */
  fetchRun: (runId: string) => void;
  /** Current run ID being fetched */
  activeRunId: string | null;
}

// ── Mock fallback ───────────────────────────────────────────────────

const MOCK_GRAPH: SafeGraph = {
  nodes: [],
  edges: [],
  isEmpty: true,
  isDense: false,
  nodeCount: 0,
  edgeCount: 0,
};

const MOCK_DATA: MappedCommandCenterData = {
  event: MOCK_EVENT,
  metrics: MOCK_METRICS,
  decisions: MOCK_DECISIONS,
  graph: MOCK_GRAPH,
  source: "mock",
};

const MOCK_READINESS: ReadinessVerdict = {
  ready: true,
  score: 80,
  checks: [
    { name: "Payload valid", passed: true, detail: "Mock data" },
    { name: "Headline metrics", passed: true, detail: "Mock data" },
    { name: "Graph renderable", passed: false, detail: "No graph in mock mode" },
    { name: "Decisions available", passed: true, detail: "3 decision(s) queued" },
    { name: "Data source", passed: true, detail: "Mock data" },
  ],
};

// ── Hook ────────────────────────────────────────────────────────────

export function useCommandCenter(): CommandCenterState {
  const [source, setSource] = useState<DataSource>("mock");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const fetchRun = useCallback((runId: string) => {
    setActiveRunId(runId);
    setSource("live");
  }, []);

  // Live query — only fires when source=live and we have a runId
  const {
    data: liveResult,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["command-center-run", activeRunId],
    queryFn: () => api.observatory.getResult(activeRunId!),
    enabled: source === "live" && !!activeRunId,
    retry: 1,
    staleTime: 30_000,
  });

  // Normalize error to string
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Unknown error fetching run"
    : null;

  // Validate + map live data
  const { data, diagnostic, readiness } = useMemo(() => {
    if (source === "mock" || !liveResult) {
      return {
        data: MOCK_DATA,
        diagnostic: null,
        readiness: MOCK_READINESS,
      };
    }

    const diag = validateRunResult(liveResult);
    const mapped = mapRunResult(liveResult, "live");
    const graphReady = assessGraphReadiness(mapped.graph);
    const verdict = computeReadiness({
      payloadDiag: diag,
      graphReady,
      decisionsCount: mapped.decisions.length,
      source: "live",
    });

    return { data: mapped, diagnostic: diag, readiness: verdict };
  }, [source, liveResult]);

  // If live fetch failed, fall back to mock data but preserve the error
  const resolvedData = error && source === "live" ? MOCK_DATA : data;

  return {
    data: resolvedData,
    source: error && source === "live" ? "mock" : source,
    isLoading,
    error,
    diagnostic,
    readiness,
    backendActionsConfirmed: false, // default safe: no execute until confirmed
    setSource,
    fetchRun,
    activeRunId,
  };
}
