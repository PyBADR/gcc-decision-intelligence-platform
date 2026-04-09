"use client";

/**
 * Demo: MacroHero
 * Full-width hero with large impact score, scenario title, top countries, top sectors.
 */

import type { GccEvent, ImpactMetric } from "@/lib/v2/types";
import { safeNumber, safeString, pct } from "./demo-helpers";

const GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", w: 0.45 },
  { code: "AE", name: "UAE", w: 0.22 },
  { code: "QA", name: "Qatar", w: 0.12 },
  { code: "KW", name: "Kuwait", w: 0.10 },
  { code: "OM", name: "Oman", w: 0.08 },
  { code: "BH", name: "Bahrain", w: 0.03 },
];

interface MacroHeroProps {
  event: GccEvent;
  metrics: ImpactMetric[];
}

export default function MacroHero({ event, metrics }: MacroHeroProps) {
  const severity = safeNumber(event.severity, 0);
  const sevPct = pct(severity);

  const sevColor =
    sevPct >= 75 ? "text-red-500" :
    sevPct >= 50 ? "text-amber-500" :
    sevPct >= 25 ? "text-yellow-500" :
    "text-emerald-500";

  const sevLabel =
    sevPct >= 75 ? "CRITICAL" :
    sevPct >= 50 ? "ELEVATED" :
    sevPct >= 25 ? "MODERATE" :
    "LOW";

  const barColor =
    sevPct >= 75 ? "bg-red-500" :
    sevPct >= 50 ? "bg-amber-500" :
    sevPct >= 25 ? "bg-yellow-500" :
    "bg-emerald-500";

  return (
    <section className="bg-zinc-950 border-b border-zinc-800 px-8 lg:px-16 py-12">
      {/* Title row */}
      <div className="flex items-start justify-between gap-8 mb-10">
        <div className="flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] font-medium mb-2">
            GCC Decision Intelligence — Stress Context
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            {safeString(event.name, "Unknown Scenario")}
          </h1>
          <p className="text-lg text-zinc-400">
            {safeString(event.region, "Region")} &middot;{" "}
            {event.timestamp
              ? new Date(event.timestamp).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—"}
          </p>
        </div>

        {/* Large severity score */}
        <div className="text-center flex-shrink-0 min-w-[160px]">
          <p className={`text-7xl lg:text-8xl font-black tabular-nums ${sevColor}`}>
            {sevPct}
          </p>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-2 mb-1">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.max(3, sevPct)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{sevLabel} SEVERITY</p>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metrics.map((m) => (
          <div key={m.label} className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-5 py-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{m.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white tabular-nums">{m.value}</span>
              <span className={`text-xs font-semibold tabular-nums ${
                m.trend === "up" ? "text-red-400" : m.trend === "down" ? "text-amber-400" : "text-zinc-500"
              }`}>{m.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Country exposure row */}
      <div>
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium mb-3">
          GCC Country Exposure — GDP Weighted
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {GCC_COUNTRIES.map((c) => {
            const exposure = Math.min(100, Math.round(severity * c.w * 300));
            const eColor = exposure > 60 ? "text-red-400" : exposure > 30 ? "text-amber-400" : "text-emerald-400";
            const eBar = exposure > 60 ? "bg-red-500" : exposure > 30 ? "bg-amber-500" : "bg-emerald-500";
            return (
              <div key={c.code} className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-4 py-3 text-center">
                <p className="text-xl font-bold text-zinc-200">{c.code}</p>
                <p className="text-[10px] text-zinc-600 mb-2">{c.name}</p>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${eBar}`} style={{ width: `${Math.max(3, exposure)}%` }} />
                </div>
                <p className={`text-[11px] font-bold tabular-nums ${eColor}`}>{exposure}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
