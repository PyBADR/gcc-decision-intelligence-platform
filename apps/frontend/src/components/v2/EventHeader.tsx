"use client";

import type { GccEvent, ImpactMetric } from "@/lib/v2/types";
import type { PanelState } from "@/features/command-center/lib/readiness-guards";

interface EventHeaderProps {
  event: GccEvent;
  metrics: ImpactMetric[];
  panelState: PanelState;
  error?: string | null;
  source?: "live" | "mock";
}

// ── Severity bar color ──────────────────────────────────────────────

function severityColor(pct: number): string {
  if (pct >= 75) return "bg-red-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-yellow-500";
  return "bg-emerald-500";
}

function severityLabel(pct: number): string {
  if (pct >= 75) return "CRITICAL";
  if (pct >= 50) return "ELEVATED";
  if (pct >= 25) return "MODERATE";
  return "LOW";
}

// ── Skeleton strips ─────────────────────────────────────────────────

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3 animate-pulse">
          <div className="h-3 w-16 bg-zinc-700 rounded mb-2" />
          <div className="h-6 w-24 bg-zinc-700 rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonMacro() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-zinc-800/40 rounded-lg px-3 py-2 animate-pulse">
          <div className="h-2.5 w-12 bg-zinc-700 rounded mb-1.5" />
          <div className="h-4 w-16 bg-zinc-700 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Macro metrics row ───────────────────────────────────────────────

interface MacroMetric {
  label: string;
  value: string;
  alert?: boolean;
}

function deriveMacroMetrics(event: GccEvent, metrics: ImpactMetric[]): MacroMetric[] {
  const find = (label: string) => metrics.find((m) => m.label === label);

  const exposure = find("Total Exposure");
  const entities = find("Entities Affected");
  const peakDay = find("Peak Day");
  const stress = find("Avg Stress");

  return [
    {
      label: "GDP Impact",
      value: exposure ? exposure.value : "—",
      alert: exposure?.trend === "up",
    },
    {
      label: "Critical Entities",
      value: (exposure?.delta && exposure.delta !== "—") ? exposure.delta : "0",
      alert: !!(exposure?.delta && exposure.delta !== "—"),
    },
    {
      label: "Affected Nodes",
      value: entities ? entities.value : "—",
    },
    {
      label: "Peak Stress Day",
      value: peakDay ? peakDay.value : "—",
    },
    {
      label: "System Stress",
      value: stress ? stress.value : "—",
      alert: stress?.trend === "up",
    },
    {
      label: "Recovery Window",
      value: peakDay?.delta ?? "—",
    },
  ];
}

// ── Component ───────────────────────────────────────────────────────

export default function EventHeader({ event, metrics, panelState, error, source }: EventHeaderProps) {
  const rawSev = Number.isFinite(event.severity) ? event.severity : 0;
  const severityPct = Math.round(rawSev * 100);
  const macroMetrics = deriveMacroMetrics(event, metrics);

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      {/* Row 1: Event identity + status */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">IO</span>
          </div>
          <div>
            {panelState === "loading" ? (
              <>
                <div className="h-5 w-48 bg-zinc-700 rounded animate-pulse" />
                <div className="h-3 w-32 bg-zinc-800 rounded mt-1.5 animate-pulse" />
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold text-zinc-100 leading-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {event.region} &middot;{" "}
                  {new Date(event.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {source && (
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                source === "live"
                  ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
                  : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
              }`}
            >
              {source}
            </span>
          )}
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
              event.status === "active"
                ? "bg-red-950 text-red-400 ring-1 ring-red-800"
                : event.status === "monitoring"
                ? "bg-amber-950 text-amber-400 ring-1 ring-amber-800"
                : "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
            }`}
          >
            {event.status}
          </span>

          {/* Severity gauge */}
          <div className="text-right min-w-[80px]">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Severity</p>
              <p className="text-xs font-bold text-red-400 tabular-nums">{severityPct}%</p>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${severityColor(severityPct)}`}
                style={{ width: `${Math.max(3, severityPct)}%` }}
              />
            </div>
            <p className="text-[9px] text-zinc-600 mt-0.5 text-right">{severityLabel(severityPct)}</p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {panelState === "error" && error && (
        <div className="mx-6 mb-2 px-4 py-2 bg-red-950/50 border border-red-900/50 rounded-lg text-xs text-red-400">
          Live data unavailable: {error} — showing cached/mock data
        </div>
      )}

      {/* Row 2: Primary metrics strip */}
      <div className="px-6 pb-2">
        {panelState === "loading" ? (
          <SkeletonMetrics />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3"
              >
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
                  {m.label}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-zinc-100 tabular-nums">
                    {m.value}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      m.trend === "up"
                        ? "text-red-400"
                        : m.trend === "down"
                        ? "text-amber-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {m.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 3: Macro metrics — derived secondary indicators */}
      <div className="px-6 pb-3 border-t border-zinc-800/60 pt-2">
        {panelState === "loading" ? (
          <SkeletonMacro />
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {macroMetrics.map((mm) => (
              <div
                key={mm.label}
                className="bg-zinc-800/40 rounded-lg px-3 py-2"
              >
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium leading-tight">
                  {mm.label}
                </p>
                <p
                  className={`text-sm font-bold tabular-nums mt-0.5 ${
                    mm.alert ? "text-red-400" : "text-zinc-300"
                  }`}
                >
                  {mm.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
