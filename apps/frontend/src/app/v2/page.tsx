"use client";

/**
 * Enterprise V2 — Hard Surface Replacement
 *
 * Macro-first executive layout. Vertical storytelling.
 * Read order: Macro → Transmission → Exposure → Decisions → Trust → Operational Detail
 *
 * Graph, pipeline, audit tables are BELOW FOLD (collapsed).
 * Decision panel is ABOVE graph.
 * Trust layer is explicit and visible.
 */

import { useState } from "react";
import EventHeader from "@/components/v2/EventHeader";
import DecisionCard from "@/components/v2/DecisionCard";
import GraphPanel from "@/components/v2/GraphPanel";
import StatusBar from "@/components/v2/StatusBar";
import { useCommandCenter } from "@/features/command-center/lib/use-command-center";
import { detectPanelState } from "@/features/command-center/lib/readiness-guards";
import type { Decision } from "@/lib/v2/types";
import type { SafeGraphEdge } from "@/features/command-center/lib/live-mappers";

// ── Safe helpers (used across all inline sections) ──────────────────

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

// ── Section heading ─────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h2>
      {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 2: Transmission Chain — horizontal flow visualization
// ══════════════════════════════════════════════════════════════════════

interface ChainStage {
  label: string;
  value: string;
  sub: string;
  level: "high" | "medium" | "low";
}

const CHAIN_COLORS = {
  high: { border: "border-red-800", bg: "bg-red-950/60", text: "text-red-400", dot: "bg-red-500" },
  medium: { border: "border-amber-800", bg: "bg-amber-950/40", text: "text-amber-400", dot: "bg-amber-500" },
  low: { border: "border-emerald-800", bg: "bg-emerald-950/30", text: "text-emerald-400", dot: "bg-emerald-500" },
};

function toLevel(v: number): "high" | "medium" | "low" {
  return v > 0.6 ? "high" : v > 0.3 ? "medium" : "low";
}

function TransmissionChain({
  severity,
  decisions,
  nodeCount,
  edgeCount,
  isEmpty,
  topEdges,
}: {
  severity: number;
  decisions: Decision[];
  nodeCount: number;
  edgeCount: number;
  isEmpty: boolean;
  topEdges: SafeGraphEdge[];
}) {
  const sev = safeNum(severity, 0);
  const criticalCount = decisions.filter((d) => d.priority === "critical").length;

  const stages: ChainStage[] = [
    {
      label: "Event Trigger",
      value: `${Math.round(sev * 100)}%`,
      sub: "severity",
      level: toLevel(sev),
    },
    {
      label: "System Transmission",
      value: isEmpty ? "—" : `${safeNum(nodeCount, 0)} nodes`,
      sub: isEmpty ? "awaiting data" : `${safeNum(edgeCount, 0)} channels`,
      level: isEmpty ? "low" : toLevel(sev * 0.85),
    },
    {
      label: "Sector Stress",
      value: isEmpty ? "—" : `${topEdges.length} paths`,
      sub: "cross-sector",
      level: toLevel(sev * 0.8),
    },
    {
      label: "Decision Required",
      value: `${decisions.length}`,
      sub: criticalCount > 0 ? `${criticalCount} critical` : "actions queued",
      level: criticalCount > 0 ? "high" : decisions.length > 0 ? "medium" : "low",
    },
  ];

  return (
    <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
      {stages.map((stage, i) => {
        const c = CHAIN_COLORS[stage.level];
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className={`border ${c.border} ${c.bg} rounded-xl px-5 py-3.5 min-w-[145px]`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-[11px] font-semibold text-zinc-300">{stage.label}</span>
              </div>
              <p className={`text-xl font-bold tabular-nums ${c.text}`}>{stage.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{stage.sub}</p>
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center px-1 flex-shrink-0">
                <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 3: Country & Sector Exposure
// ══════════════════════════════════════════════════════════════════════

const GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", gdpWeight: 0.45 },
  { code: "AE", name: "UAE", gdpWeight: 0.22 },
  { code: "QA", name: "Qatar", gdpWeight: 0.12 },
  { code: "KW", name: "Kuwait", gdpWeight: 0.10 },
  { code: "OM", name: "Oman", gdpWeight: 0.08 },
  { code: "BH", name: "Bahrain", gdpWeight: 0.03 },
];

function exposureLevel(pct: number): { label: string; color: string; barColor: string; textColor: string } {
  if (pct > 60) return { label: "HIGH", color: "border-red-800/50", barColor: "bg-red-500", textColor: "text-red-400" };
  if (pct > 30) return { label: "MEDIUM", color: "border-amber-800/40", barColor: "bg-amber-500", textColor: "text-amber-400" };
  return { label: "LOW", color: "border-emerald-800/30", barColor: "bg-emerald-500", textColor: "text-zinc-500" };
}

function CountryExposureGrid({ severity }: { severity: number }) {
  const sev = safeNum(severity, 0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {GCC_COUNTRIES.map((c) => {
        const exposure = Math.min(1, sev * c.gdpWeight * 3);
        const pct = Math.round(exposure * 100);
        const lvl = exposureLevel(pct);
        return (
          <div key={c.code} className={`bg-zinc-800/40 border ${lvl.color} rounded-lg px-4 py-3 text-center`}>
            <p className="text-xl font-bold text-zinc-200">{c.code}</p>
            <p className="text-[10px] text-zinc-500 mb-2">{c.name}</p>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-1">
              <div
                className={`h-full rounded-full ${lvl.barColor}`}
                style={{ width: `${Math.max(3, pct)}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className={`text-[10px] font-bold tabular-nums ${lvl.textColor}`}>
                {pct}%
              </span>
              <span className={`text-[8px] font-bold uppercase ${lvl.textColor}`}>
                {lvl.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 5: Trust Layer
// ══════════════════════════════════════════════════════════════════════

function deriveAuditHash(eventId: string, timestamp: string): string {
  const input = `${eventId}:${timestamp}`;
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return `0x${Math.abs(h).toString(16).padStart(8, "0").toUpperCase()}`;
}

function TrustLayer({
  readiness,
  source,
  eventId,
  timestamp,
  decisions,
}: {
  readiness: { score: number; checks: { name: string; passed: boolean; detail: string }[] };
  source: string;
  eventId: string;
  timestamp: string;
  decisions: Decision[];
}) {
  const score = safeNum(readiness.score, 0);
  const checks = readiness.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const auditHash = deriveAuditHash(safeStr(eventId, "unknown"), safeStr(timestamp, ""));

  const scoreColor =
    score >= 80 ? "text-emerald-400" :
    score >= 50 ? "text-amber-400" :
    "text-red-400";

  // Derive assumptions from data state
  const assumptions: string[] = [];
  if (source === "mock") assumptions.push("Using simulated data — not live backend");
  if (decisions.length === 0) assumptions.push("No decision actions available");
  const hasLoss = decisions.some((d) => d.loss_inducing);
  if (hasLoss) assumptions.push("Contains loss-inducing actions — execution blocked");
  const lowConf = decisions.filter((d) => safeNum(d.confidence, 0) < 0.5);
  if (lowConf.length > 0) assumptions.push(`${lowConf.length} decision(s) below 50% confidence`);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Trust Score */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-center">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Trust Score</p>
        <p className={`text-5xl font-black tabular-nums ${scoreColor}`}>{score}%</p>
        <p className="text-xs text-zinc-500 mt-1.5">{passed}/{checks.length} checks passed</p>
      </div>

      {/* Data Integrity Indicators */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Data Integrity</p>
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${c.passed ? "bg-emerald-500" : "bg-zinc-600"}`} />
                <span className="text-xs text-zinc-300">{c.name}</span>
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums">{c.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Trail + Assumptions */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Audit & Assumptions</p>
        <div className="space-y-2 mb-4">
          <AuditRow label="Audit Hash" value={auditHash} mono />
          <AuditRow label="Source" value={source.toUpperCase()} />
          <AuditRow
            label="Timestamp"
            value={timestamp ? new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
          />
          <AuditRow label="Readiness" value={`${score}%`} />
        </div>
        {assumptions.length > 0 && (
          <>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Assumptions</p>
            <div className="space-y-1">
              {assumptions.map((a, i) => (
                <p key={i} className="text-[10px] text-zinc-500 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {a}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuditRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-zinc-300 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 6: Operational Detail — collapsed by default
// ══════════════════════════════════════════════════════════════════════

function CollapsibleOperationalDetail({
  children,
  graphSummary,
}: {
  children: React.ReactNode;
  graphSummary: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">
            Operational Detail
          </h2>
        </div>
        <span className="text-[10px] text-zinc-600">{graphSummary}</span>
      </button>

      {expanded && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PAGE: Enterprise V2 — Hard Surface
// ══════════════════════════════════════════════════════════════════════

export default function EnterpriseV2Page() {
  const cc = useCommandCenter();

  const headerState = detectPanelState({
    isLoading: cc.isLoading,
    error: cc.error,
    hasData: !!cc.data.event.id,
  });

  const graphState = detectPanelState({
    isLoading: cc.isLoading,
    error: cc.error,
    hasData: !cc.data.graph.isEmpty,
  });

  const decisionState = detectPanelState({
    isLoading: cc.isLoading,
    error: cc.error,
    hasData: cc.data.decisions.length > 0,
  });

  const topEdges = [...cc.data.graph.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 9);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ═══ SECTION 1: GCC Macro Overview ═══
          Scenario title, severity gauge, headline metrics, top sectors.
          EventHeader already implements all of this. */}
      <EventHeader
        event={cc.data.event}
        metrics={cc.data.metrics}
        panelState={headerState}
        error={cc.error}
        source={cc.source}
      />

      {/* ═══ SECTION 2: Transmission Channels ═══
          Horizontal flow chain + top edge paths.
          Readable in <5 seconds. No graph library. */}
      <section className="px-6 py-6 border-b border-zinc-800/60">
        <SectionHeading
          title="Transmission Channels"
          subtitle={cc.data.graph.isEmpty
            ? "No propagation data"
            : `${cc.data.graph.nodeCount} nodes · ${cc.data.graph.edgeCount} edges`}
        />

        {/* Horizontal chain visualization */}
        <TransmissionChain
          severity={cc.data.event.severity}
          decisions={cc.data.decisions}
          nodeCount={cc.data.graph.nodeCount}
          edgeCount={cc.data.graph.edgeCount}
          isEmpty={cc.data.graph.isEmpty}
          topEdges={topEdges}
        />

        {/* Top propagation paths (if data exists) */}
        {!cc.data.graph.isEmpty && topEdges.length > 0 && (
          <div className="mt-4 bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-2">
              Top Transmission Paths by Weight
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
              {topEdges.map((edge, i) => {
                const w = safeNum(edge.weight, 0);
                const pctVal = Math.round(w * 100);
                const sourceNode = cc.data.graph.nodes.find((n) => n.id === edge.source);
                const targetNode = cc.data.graph.nodes.find((n) => n.id === edge.target);
                return (
                  <div key={`${edge.source}-${edge.target}-${i}`} className="flex items-center gap-2 text-[11px]">
                    <span className="text-zinc-400 truncate min-w-[60px]">{sourceNode?.label ?? edge.source}</span>
                    <span className={`font-mono tabular-nums ${pctVal > 60 ? "text-red-400" : pctVal > 30 ? "text-amber-400" : "text-zinc-500"}`}>
                      →{pctVal}%→
                    </span>
                    <span className="text-zinc-400 truncate min-w-[60px]">{targetNode?.label ?? edge.target}</span>
                  </div>
                );
              })}
            </div>
            {cc.data.graph.edgeCount > 9 && (
              <p className="text-[10px] text-zinc-600 pt-2 mt-2 border-t border-zinc-800/40">
                +{cc.data.graph.edgeCount - 9} more — expand Operational Detail below
              </p>
            )}
          </div>
        )}
      </section>

      {/* ═══ SECTION 3: Country & Sector Exposure ═══
          GCC countries with clear High / Medium / Low labels. */}
      <section className="px-6 py-6 border-b border-zinc-800/60">
        <SectionHeading
          title="Country & Sector Exposure"
          subtitle="GDP-weighted impact across GCC member states"
        />
        <CountryExposureGrid severity={cc.data.event.severity} />
      </section>

      {/* ═══ SECTION 4: Decision Priorities ═══
          Full-width. Cost, benefit, net, confidence, loss flags.
          This is the PRIMARY action surface. */}
      <section className="border-b border-zinc-800/60">
        <DecisionCard
          decisions={cc.data.decisions}
          panelState={decisionState}
          error={cc.error}
          liveMode={cc.source === "live"}
          backendActionsConfirmed={cc.backendActionsConfirmed}
        />
      </section>

      {/* ═══ SECTION 5: Trust Layer ═══
          Confidence, audit hash, assumptions, data integrity. */}
      <section className="px-6 py-6 border-b border-zinc-800/60">
        <SectionHeading
          title="Trust & Confidence"
          subtitle="Quality checks, audit trail, and operating assumptions"
        />
        <TrustLayer
          readiness={cc.readiness}
          source={cc.source}
          eventId={cc.data.event.id}
          timestamp={cc.data.event.timestamp}
          decisions={cc.data.decisions}
        />
      </section>

      {/* ═══ SECTION 6: Operational Detail — COLLAPSED ═══
          Graph, pipeline status, sector node detail.
          Below fold. Not the primary reading surface. */}
      <section className="px-6 py-6">
        <CollapsibleOperationalDetail
          graphSummary={cc.data.graph.isEmpty
            ? "No graph data"
            : `System graph: ${cc.data.graph.nodeCount} nodes · ${cc.data.graph.edgeCount} edges`}
        >
          <div className="border border-zinc-800 rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
            <GraphPanel
              graph={cc.data.graph}
              panelState={graphState}
              error={cc.error}
            />
          </div>
        </CollapsibleOperationalDetail>
      </section>

      {/* ═══ STATUS BAR ═══ */}
      <StatusBar
        readiness={cc.readiness}
        source={cc.source}
        error={cc.error}
        onToggleSource={() => cc.setSource(cc.source === "mock" ? "live" : "mock")}
      />
    </div>
  );
}
