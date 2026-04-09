"use client";

import type { Decision } from "@/lib/v2/types";
import type { PanelState } from "@/features/command-center/lib/readiness-guards";
import { assessActionSafety, type ActionSafety } from "@/features/command-center/lib/readiness-guards";

interface DecisionCardProps {
  decisions: Decision[];
  panelState: PanelState;
  error?: string | null;
  liveMode?: boolean;
  backendActionsConfirmed?: boolean;
}

// ── Safe number helper ──────────────────────────────────────────────

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ── Trust indicators ────────────────────────────────────────────────

interface TrustSignals {
  deadlineLabel: string;
  deadlineUrgent: boolean;
  hasOwner: boolean;
  hasRationale: boolean;
  trustScore: number; // 0..3
  trustLabel: string;
  trustColor: string;
}

function computeTrust(d: Decision): TrustSignals {
  // Deadline proximity
  const deadlineMs = new Date(d.deadline).getTime();
  const validDeadline = Number.isFinite(deadlineMs);
  const hoursLeft = validDeadline ? safeNum((deadlineMs - Date.now()) / 3_600_000, 0) : 0;
  let deadlineLabel: string;
  if (!validDeadline) {
    deadlineLabel = "No deadline";
  } else if (hoursLeft <= 0) {
    deadlineLabel = "Overdue";
  } else if (hoursLeft < 24) {
    deadlineLabel = `${Math.round(hoursLeft)}h left`;
  } else {
    deadlineLabel = `${Math.round(hoursLeft / 24)}d left`;
  }
  const deadlineUrgent = validDeadline && hoursLeft < 24;

  // Owner and rationale presence
  const hasOwner = typeof d.owner === "string" && d.owner.length > 0 && d.owner !== "Unassigned";
  const hasRationale = typeof d.rationale === "string" && d.rationale.length > 10;

  // Trust score: 0–4 based on completeness + confidence
  let trustScore = 0;
  if (hasOwner) trustScore++;
  if (hasRationale) trustScore++;
  if (typeof d.impact_usd === "string" && d.impact_usd !== "$0") trustScore++;
  if (safeNum(d.confidence, 0) >= 0.7) trustScore++;

  const trustLabel =
    trustScore >= 4 ? "High Trust" :
    trustScore >= 3 ? "Good" :
    trustScore >= 2 ? "Partial" :
    "Low Trust";
  const trustColor =
    trustScore >= 4 ? "text-emerald-400" :
    trustScore >= 3 ? "text-zinc-400" :
    trustScore >= 2 ? "text-amber-400" :
    "text-red-400";

  return {
    deadlineLabel,
    deadlineUrgent,
    hasOwner,
    hasRationale,
    trustScore,
    trustLabel,
    trustColor,
  };
}

// ── Styles ──────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Decision["priority"], { badge: string; border: string }> = {
  critical: {
    badge: "bg-red-950 text-red-400 ring-1 ring-red-800",
    border: "border-red-900/50",
  },
  high: {
    badge: "bg-amber-950 text-amber-400 ring-1 ring-amber-800",
    border: "border-amber-900/40",
  },
  medium: {
    badge: "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700",
    border: "border-zinc-700/50",
  },
};

const STATUS_DOT: Record<Decision["status"], string> = {
  pending: "bg-zinc-500",
  in_progress: "bg-amber-400",
  executed: "bg-emerald-400",
};

const ACTION_MODE_STYLES: Record<ActionSafety["mode"], { label: string; icon: string; className: string }> = {
  review: {
    label: "Review",
    icon: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    className: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
  propose: {
    label: "Propose",
    icon: "M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
    className: "bg-amber-950 text-amber-400 border-amber-800",
  },
  execute: {
    label: "Execute",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    className: "bg-emerald-950 text-emerald-400 border-emerald-800",
  },
};

// ── Trust dots ──────────────────────────────────────────────────────

function TrustDots({ score }: { score: number }) {
  const s = safeNum(score, 0);
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1 h-1 rounded-full ${
            i < s
              ? s >= 4 ? "bg-emerald-500" : s >= 3 ? "bg-zinc-400" : s >= 2 ? "bg-amber-500" : "bg-red-500"
              : "bg-zinc-700"
          }`}
        />
      ))}
    </span>
  );
}

// ── State screens ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-5 py-12 text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      </div>
      <p className="text-sm text-zinc-500">No decisions available</p>
      <p className="text-xs text-zinc-600 mt-1">Run a scenario to generate decision actions</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-zinc-800/70">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-48 bg-zinc-800 rounded" />
            <div className="h-4 w-16 bg-zinc-800 rounded-full" />
          </div>
          <div className="h-3 w-full bg-zinc-800/60 rounded mb-1" />
          <div className="h-3 w-3/4 bg-zinc-800/60 rounded mb-3" />
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-zinc-800/40 rounded" />
            <div className="h-3 w-16 bg-zinc-800/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-sm text-red-400">Failed to load decisions</p>
      <p className="text-xs text-zinc-500 mt-1">{error}</p>
    </div>
  );
}

// ── Summary bar ─────────────────────────────────────────────────────

function QueueSummary({ decisions }: { decisions: Decision[] }) {
  const critical = decisions.filter((d) => d.priority === "critical").length;
  const high = decisions.filter((d) => d.priority === "high").length;
  const medium = decisions.filter((d) => d.priority === "medium").length;

  return (
    <div className="px-5 py-2 border-b border-zinc-800/60 flex items-center gap-3">
      {critical > 0 && (
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400 font-semibold">{critical} critical</span>
        </span>
      )}
      {high > 0 && (
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-400 font-semibold">{high} high</span>
        </span>
      )}
      {medium > 0 && (
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-zinc-400 font-semibold">{medium} medium</span>
        </span>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export default function DecisionCard({
  decisions,
  panelState,
  error,
  liveMode = false,
  backendActionsConfirmed = false,
}: DecisionCardProps) {
  return (
    <aside className="bg-zinc-900 border-t border-zinc-800 w-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Decision Priorities
          </h2>
          <div className="flex items-center gap-2">
            {!backendActionsConfirmed && liveMode && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-950 text-amber-400 ring-1 ring-amber-800">
                Read-Only
              </span>
            )}
            {!liveMode && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700">
                Mock
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {panelState === "ready"
            ? `${safeNum(decisions.length, 0)} action${decisions.length !== 1 ? "s" : ""} \u00B7 sorted by priority`
            : panelState === "loading"
            ? "Loading decisions..."
            : "\u2014"
          }
        </p>
      </div>

      {panelState === "loading" && <LoadingSkeleton />}
      {panelState === "error" && <ErrorState error={error ?? "Unknown error"} />}
      {panelState === "empty" && <EmptyState />}

      {panelState === "ready" && decisions.length === 0 && <EmptyState />}

      {panelState === "ready" && decisions.length > 0 && (
        <>
          <QueueSummary decisions={decisions} />
          <div className="divide-y divide-zinc-800/70">
            {decisions.map((d) => {
              const style = PRIORITY_STYLES[d.priority] ?? PRIORITY_STYLES.medium;
              const safety = assessActionSafety(d, { backendActionsConfirmed, liveMode });
              const actionStyle = ACTION_MODE_STYLES[safety.mode];
              const trust = computeTrust(d);

              return (
                <div key={d.id} className={`px-5 py-4 ${style.border} hover:bg-zinc-800/40 transition-colors`}>
                  {/* Row 1: Title + priority */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="text-sm font-semibold text-zinc-100 leading-snug flex-1">
                      {d.title || "Unnamed Action"}
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full whitespace-nowrap ${style.badge}`}>
                      {d.priority || "—"}
                    </span>
                  </div>

                  {/* Row 2: Trust + deadline indicators */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="flex items-center gap-1.5">
                      <TrustDots score={trust.trustScore} />
                      <span className={`text-[10px] font-medium ${trust.trustColor}`}>{trust.trustLabel}</span>
                    </span>
                    <span className={`text-[10px] font-medium tabular-nums ${trust.deadlineUrgent ? "text-red-400" : "text-zinc-500"}`}>
                      {trust.deadlineLabel}
                    </span>
                    {!trust.hasOwner && (
                      <span className="text-[10px] text-red-400/70">No owner</span>
                    )}
                  </div>

                  {/* Row 3: Rationale */}
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {d.rationale || "No rationale provided."}
                  </p>

                  {/* Row 4: Cost/Benefit + Confidence */}
                  <div className="flex items-center gap-3 text-[11px] mb-2">
                    <span className="text-zinc-500">Avoid: <span className="text-zinc-200 font-semibold tabular-nums">{d.impact_usd || "$0"}</span></span>
                    <span className="text-zinc-500">Cost: <span className="text-zinc-200 font-semibold tabular-nums">{d.cost_usd || "$0"}</span></span>
                    <span className={`font-semibold tabular-nums ${d.loss_inducing ? "text-red-400" : "text-emerald-400"}`}>
                      Net: {d.loss_inducing ? "−" : "+"}{d.net_benefit_usd || "$0"}
                    </span>
                  </div>

                  {/* Loss-inducing flag */}
                  {d.loss_inducing && (
                    <div className="mb-2 px-2.5 py-1.5 bg-red-950/50 border border-red-900/50 rounded text-[10px] text-red-400 flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      Cost exceeds loss avoidance — net negative action
                    </div>
                  )}

                  {/* Confidence bar */}
                  <div className="flex items-center gap-2 mb-3 text-[10px]">
                    <span className="text-zinc-500">Confidence</span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          safeNum(d.confidence, 0) >= 0.7 ? "bg-emerald-500" : safeNum(d.confidence, 0) >= 0.4 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.max(3, safeNum(d.confidence, 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-zinc-400 tabular-nums">{Math.round(safeNum(d.confidence, 0) * 100)}%</span>
                  </div>

                  {/* Row 5: Meta */}
                  <div className="flex items-center justify-between text-[11px] mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{d.owner || "Unassigned"}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status] ?? STATUS_DOT.pending}`} />
                        <span className="text-zinc-500 capitalize">
                          {(d.status || "pending").replace("_", " ")}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Row 6: Action button — safety-gated */}
                  <div className="flex items-center justify-between">
                    <button
                      disabled={!safety.canExecute || d.loss_inducing}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                        d.loss_inducing
                          ? "bg-red-950/50 text-red-400/60 border-red-900/40 cursor-not-allowed"
                          : `${actionStyle.className} ${safety.canExecute ? "cursor-pointer hover:brightness-110" : "cursor-default opacity-80"}`
                      }`}
                      title={d.loss_inducing ? "Blocked: net-negative action" : safety.reason}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={actionStyle.icon} />
                      </svg>
                      {d.loss_inducing ? "Blocked" : actionStyle.label}
                    </button>
                    <span className="text-[10px] text-zinc-600 max-w-[160px] truncate" title={d.loss_inducing ? "Net-negative action" : safety.reason}>
                      {d.loss_inducing ? "Net-negative action" : safety.reason}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
