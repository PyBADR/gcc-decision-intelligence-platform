"use client";

/**
 * Demo: OptionalDetail
 * Collapsed by default. Shows GraphPanel + pipeline info when expanded.
 */

import { useState } from "react";
import GraphPanel from "@/components/v2/GraphPanel";
import type { SafeGraph } from "@/features/command-center/lib/live-mappers";
import type { PanelState } from "@/features/command-center/lib/readiness-guards";
import type { ReadinessVerdict } from "@/features/command-center/lib/readiness-guards";

interface OptionalDetailProps {
  graph: SafeGraph;
  graphState: PanelState;
  readiness: ReadinessVerdict;
  error?: string | null;
}

export default function OptionalDetail({ graph, graphState, readiness, error }: OptionalDetailProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="bg-zinc-950 px-8 lg:px-16 py-10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 group mb-4"
      >
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium group-hover:text-zinc-400 transition-colors">
          Operational Detail
        </span>
        <span className="text-[10px] text-zinc-700">
          System graph, pipeline logs, readiness checks
        </span>
      </button>

      {expanded && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* System Graph */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
            <GraphPanel graph={graph} panelState={graphState} error={error} />
          </div>

          {/* Pipeline readiness */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-3">
              Pipeline Status
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {readiness.checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.passed ? "bg-emerald-500" : "bg-zinc-600"}`} />
                  <div>
                    <p className="text-[11px] text-zinc-400">{c.name}</p>
                    <p className="text-[10px] text-zinc-600">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
