"use client";

/**
 * Demo: TransmissionFlow
 * Horizontal chain showing event → impact → stress → decision.
 * No graph library. Pure CSS.
 */

import type { GccEvent, ImpactMetric, Decision } from "@/lib/v2/types";
import { safeNumber, safeString, pct } from "./demo-helpers";
import type { SafeGraph } from "@/features/command-center/lib/live-mappers";

interface DemoTransmissionFlowProps {
  event: GccEvent;
  metrics: ImpactMetric[];
  decisions: Decision[];
  graph: SafeGraph;
}

interface Stage {
  label: string;
  value: string;
  sub: string;
  level: "high" | "medium" | "low";
}

const LEVEL_STYLES = {
  high: { border: "border-red-800", bg: "bg-red-950/60", text: "text-red-400", dot: "bg-red-500" },
  medium: { border: "border-amber-800", bg: "bg-amber-950/40", text: "text-amber-400", dot: "bg-amber-500" },
  low: { border: "border-emerald-800", bg: "bg-emerald-950/30", text: "text-emerald-400", dot: "bg-emerald-500" },
};

function toLevel(v: number): "high" | "medium" | "low" {
  return v > 0.6 ? "high" : v > 0.3 ? "medium" : "low";
}

export default function DemoTransmissionFlow({ event, metrics, decisions, graph }: DemoTransmissionFlowProps) {
  const severity = safeNumber(event.severity, 0);
  const exposure = metrics.find((m) => m.label === "Total Exposure");
  const entities = metrics.find((m) => m.label === "Entities Affected");

  const stages: Stage[] = [
    {
      label: "Event Trigger",
      value: `${pct(severity)}%`,
      sub: safeString(event.name, "Scenario"),
      level: toLevel(severity),
    },
    {
      label: "Financial Exposure",
      value: safeString(exposure?.value, "—"),
      sub: `${safeString(entities?.value, "0")} entities`,
      level: toLevel(severity * 0.9),
    },
    {
      label: "System Transmission",
      value: `${safeNumber(graph.nodeCount, 0)} nodes`,
      sub: `${safeNumber(graph.edgeCount, 0)} channels`,
      level: graph.isEmpty ? "low" : toLevel(severity * 0.8),
    },
    {
      label: "Sector Stress",
      value: safeString(exposure?.delta, "—"),
      sub: "cross-sector",
      level: toLevel(severity * 0.85),
    },
    {
      label: "Decision Required",
      value: `${decisions.length} actions`,
      sub: `${decisions.filter((d) => d.priority === "critical").length} critical`,
      level: decisions.some((d) => d.priority === "critical") ? "high" : "medium",
    },
  ];

  return (
    <section className="bg-zinc-950 border-b border-zinc-800 px-8 lg:px-16 py-10">
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium mb-1">
        Transmission Mechanics
      </p>
      <p className="text-xs text-zinc-500 mb-6">
        Event propagation path across GCC financial sectors
      </p>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const s = LEVEL_STYLES[stage.level];
          return (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className={`border ${s.border} ${s.bg} rounded-xl px-5 py-4 min-w-[155px]`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-[11px] font-semibold text-zinc-300">{stage.label}</span>
                </div>
                <p className={`text-xl font-bold tabular-nums ${s.text}`}>{stage.value}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{stage.sub}</p>
              </div>
              {i < stages.length - 1 && (
                <div className="flex items-center px-1.5 flex-shrink-0">
                  <svg className="w-6 h-6 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
