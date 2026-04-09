"use client";

/**
 * SECTION 4: DecisionPriorityPanel
 * Full-width decision priority list with action, cost saving, loss risk, confidence.
 */

import type { RunResult, DecisionAction, Classification, Language } from "@/types/observatory";

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function formatUsd(v: number): string {
  const n = safeNumber(v, 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ── Loss-inducing detection ─────────────────────────────────────────

function isLossInducing(action: DecisionAction): boolean {
  const cost = safeNumber(action.cost_usd, 0);
  const avoided = safeNumber(action.loss_avoided_usd, 0);
  return cost > avoided && cost > 0;
}

// ── Urgency badge ───────────────────────────────────────────────────

function urgencyLevel(urgency: number): { label: string; className: string } {
  const u = safeNumber(urgency, 0);
  if (u > 50) return { label: "CRITICAL", className: "bg-red-100 text-red-700 border-red-200" };
  if (u > 10) return { label: "ELEVATED", className: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "MODERATE", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
}

// ── Confidence bar ──────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(safeNumber(confidence, 0) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-io-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <span className="text-[11px] text-io-secondary tabular-nums font-medium">{pct}%</span>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

interface DecisionPriorityPanelProps {
  data: RunResult;
  lang: Language;
  onViewAll?: () => void;
}

export default function DecisionPriorityPanel({ data, lang, onViewAll }: DecisionPriorityPanelProps) {
  const isAr = lang === "ar";
  const actions = data.decisions?.actions ?? [];

  if (actions.length === 0) {
    return (
      <section className="px-6 lg:px-10 py-5 border-b border-io-border">
        <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider mb-3">
          {isAr ? "أولويات القرار" : "Decision Priorities"}
        </h2>
        <div className="bg-io-surface border border-io-border rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-io-secondary">{isAr ? "لا توجد قرارات متاحة" : "No decision priorities available"}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 lg:px-10 py-5 border-b border-io-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider">
            {isAr ? "أولويات القرار" : "Decision Priorities"}
          </h2>
          <p className="text-[11px] text-io-secondary mt-0.5">
            {actions.length} {isAr ? "إجراء مُرتب حسب الأولوية" : `action${actions.length !== 1 ? "s" : ""} ranked by priority`}
          </p>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-io-accent hover:text-io-accent/80 font-medium transition-colors"
          >
            {isAr ? "عرض الكل ←" : "View All →"}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {actions.map((action, i) => {
          const lossFlag = isLossInducing(action);
          const urg = urgencyLevel(action.urgency);
          const cost = safeNumber(action.cost_usd, 0);
          const avoided = safeNumber(action.loss_avoided_usd, 0);
          const net = avoided - cost;
          const confidence = safeNumber(action.confidence, 0);

          return (
            <div
              key={action.id ?? i}
              className={`bg-io-surface border rounded-xl p-5 shadow-sm ${
                lossFlag ? "border-red-300" : "border-io-border"
              }`}
            >
              {/* Top: rank + action + urgency badge */}
              <div className="flex items-start gap-4 mb-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-io-accent text-white flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-io-primary leading-snug">
                    {safeString(isAr ? action.action_ar : null, safeString(action.action, "Unnamed Action"))}
                  </p>
                  <p className="text-xs text-io-secondary mt-0.5">
                    {isAr ? "المسؤول" : "Owner"}: {safeString(action.owner, "Unassigned")} · {safeString(action.sector, "—")}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${urg.className}`}>
                  {urg.label}
                </span>
              </div>

              {/* Middle: cost/benefit metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-io-secondary uppercase">{isAr ? "خسائر مُتجنبة" : "Loss Avoided"}</p>
                  <p className="text-sm font-bold text-io-primary tabular-nums">{formatUsd(avoided)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-io-secondary uppercase">{isAr ? "التكلفة" : "Cost"}</p>
                  <p className="text-sm font-bold text-io-primary tabular-nums">{formatUsd(cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-io-secondary uppercase">{isAr ? "الصافي" : "Net Benefit"}</p>
                  <p className={`text-sm font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {net >= 0 ? "+" : "−"}{formatUsd(Math.abs(net))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-io-secondary uppercase mb-1">{isAr ? "الثقة" : "Confidence"}</p>
                  <ConfidenceBar confidence={confidence} />
                </div>
              </div>

              {/* Loss-inducing flag */}
              {lossFlag && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {isAr ? "التكلفة تتجاوز الخسائر المتجنبة — إجراء سلبي صافي" : "Cost exceeds loss avoidance — net negative action"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
