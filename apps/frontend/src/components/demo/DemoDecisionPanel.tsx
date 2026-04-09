"use client";

/**
 * Demo: DecisionPanel
 * Full-width decision cards with action, cost, benefit, net, confidence, loss flag.
 */

import type { Decision } from "@/lib/v2/types";
import { safeNumber, safeString } from "./demo-helpers";

interface DemoDecisionPanelProps {
  decisions: Decision[];
}

const PRIORITY_RING = {
  critical: "ring-red-700 bg-red-950/50",
  high: "ring-amber-700 bg-amber-950/40",
  medium: "ring-zinc-700 bg-zinc-800/60",
};

export default function DemoDecisionPanel({ decisions }: DemoDecisionPanelProps) {
  if (decisions.length === 0) {
    return (
      <section className="bg-zinc-950 border-b border-zinc-800 px-8 lg:px-16 py-10">
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium mb-1">Decision Priorities</p>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No decision priorities available</p>
        </div>
      </section>
    );
  }

  const critCount = decisions.filter((d) => d.priority === "critical").length;
  const highCount = decisions.filter((d) => d.priority === "high").length;

  return (
    <section className="bg-zinc-950 border-b border-zinc-800 px-8 lg:px-16 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium mb-1">
            Decision Priorities
          </p>
          <p className="text-xs text-zinc-500">
            {decisions.length} action{decisions.length !== 1 ? "s" : ""} queued — ranked by priority
          </p>
        </div>
        <div className="flex items-center gap-3">
          {critCount > 0 && (
            <span className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-400 font-semibold">{critCount} critical</span>
            </span>
          )}
          {highCount > 0 && (
            <span className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-amber-400 font-semibold">{highCount} high</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {decisions.map((d, i) => {
          const ringStyle = PRIORITY_RING[d.priority] ?? PRIORITY_RING.medium;
          const confidence = safeNumber(d.confidence, 0);
          const confPct = Math.round(confidence * 100);
          const confColor = confPct >= 70 ? "bg-emerald-500" : confPct >= 40 ? "bg-amber-500" : "bg-red-500";

          return (
            <div key={d.id} className={`ring-1 ${ringStyle} rounded-xl p-6`}>
              {/* Row 1: rank + title + priority */}
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl font-black text-zinc-700 tabular-nums leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {safeString(d.title, "Unnamed Action")}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {safeString(d.owner, "Unassigned")} · {safeString((d.status || "pending").replace("_", " "), "pending")}
                  </p>
                </div>
                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ring-1 whitespace-nowrap ${
                  d.priority === "critical" ? "text-red-400 ring-red-700 bg-red-950" :
                  d.priority === "high" ? "text-amber-400 ring-amber-700 bg-amber-950" :
                  "text-zinc-400 ring-zinc-700 bg-zinc-800"
                }`}>
                  {d.priority}
                </span>
              </div>

              {/* Row 2: rationale */}
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">
                {safeString(d.rationale, "No rationale provided.")}
              </p>

              {/* Row 3: cost/benefit grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <Metric label="Loss Avoided" value={safeString(d.impact_usd, "$0")} />
                <Metric label="Cost" value={safeString(d.cost_usd, "$0")} />
                <Metric
                  label="Net Benefit"
                  value={`${d.loss_inducing ? "−" : "+"}${safeString(d.net_benefit_usd, "$0")}`}
                  alert={d.loss_inducing}
                />
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full ${confColor}`} style={{ width: `${Math.max(3, confPct)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-zinc-300 tabular-nums">{confPct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Deadline</p>
                  <p className="text-sm font-semibold text-zinc-300">
                    {d.deadline ? formatDeadline(d.deadline) : "—"}
                  </p>
                </div>
              </div>

              {/* Loss-inducing flag */}
              {d.loss_inducing && (
                <div className="px-4 py-2.5 bg-red-950/50 border border-red-900/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Cost exceeds loss avoidance — net negative action. Execution blocked.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${alert ? "text-red-400" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}

function formatDeadline(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const hours = (ms - Date.now()) / 3_600_000;
  if (hours <= 0) return "Overdue";
  if (hours < 24) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}
