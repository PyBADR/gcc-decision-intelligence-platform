"use client";

import type { SafeGraph, SafeGraphNode, SafeGraphEdge } from "@/features/command-center/lib/live-mappers";
import type { PanelState } from "@/features/command-center/lib/readiness-guards";
import { assessGraphReadiness } from "@/features/command-center/lib/readiness-guards";

interface GraphPanelProps {
  graph: SafeGraph;
  panelState: PanelState;
  error?: string | null;
}

// ── Stress colors ───────────────────────────────────────────────────

function stressColor(s: number): string {
  if (s > 0.7) return "border-red-700 bg-red-950/60";
  if (s > 0.4) return "border-amber-700 bg-amber-950/40";
  return "border-emerald-800 bg-emerald-950/30";
}

function stressBarColor(s: number): string {
  if (s > 0.7) return "bg-red-500";
  if (s > 0.4) return "bg-amber-500";
  return "bg-emerald-500";
}

function stressDot(s: number): string {
  if (s > 0.7) return "bg-red-500";
  if (s > 0.4) return "bg-amber-500";
  return "bg-emerald-500";
}

function edgeColor(w: number): string {
  if (w > 0.7) return "text-red-500";
  if (w > 0.4) return "text-amber-500";
  return "text-zinc-600";
}

// ── Sector grouping ─────────────────────────────────────────────────

const SECTOR_LABELS: Record<string, string> = {
  banking: "Banking",
  insurance: "Insurance",
  fintech: "Fintech",
  energy: "Energy",
  maritime: "Maritime",
  aviation: "Aviation",
  trade: "Trade",
  unknown: "Other",
};

function groupBySector(nodes: SafeGraphNode[]): Record<string, SafeGraphNode[]> {
  const groups: Record<string, SafeGraphNode[]> = {};
  for (const node of nodes) {
    const key = node.sector || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(node);
  }
  // Sort each group by stress descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.stress - a.stress);
  }
  return groups;
}

// ── Transmission edge row ───────────────────────────────────────────

function TransmissionEdge({ edge, nodes }: { edge: SafeGraphEdge; nodes: SafeGraphNode[] }) {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return null;

  const w = Number.isFinite(edge.weight) ? edge.weight : 0;
  const pct = Math.round(w * 100);

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex items-center gap-1.5 min-w-[100px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stressDot(sourceNode.stress)}`} />
        <span className="text-[10px] text-zinc-400 truncate">{sourceNode.label}</span>
      </span>

      {/* Direction arrow with weight */}
      <span className={`flex items-center gap-0.5 ${edgeColor(edge.weight)}`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6h8m-3-3l3 3-3 3" />
        </svg>
        <span className="text-[9px] font-mono tabular-nums">{pct}%</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6h8m-3-3l3 3-3 3" />
        </svg>
      </span>

      <span className="flex items-center gap-1.5 min-w-[100px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stressDot(targetNode.stress)}`} />
        <span className="text-[10px] text-zinc-400 truncate">{targetNode.label}</span>
      </span>
    </div>
  );
}

// ── Node block ──────────────────────────────────────────────────────

function NodeBlock({ node }: { node: SafeGraphNode }) {
  const stress = Number.isFinite(node.stress) ? node.stress : 0;
  const pct = Math.round(stress * 100);
  return (
    <div
      className={`border rounded-lg px-3 py-2 ${stressColor(node.stress)} transition-colors`}
      title={`${node.label} — ${node.sector} — stress: ${pct}%`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] text-zinc-200 font-medium truncate flex-1">{node.label}</p>
        <span className="text-[10px] font-bold tabular-nums text-zinc-400">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${stressBarColor(node.stress)}`}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );
}

// ── State screens ───────────────────────────────────────────────────

function EmptyGraphState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <svg className="w-7 h-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">System Graph</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          No propagation data available. Run a live scenario to populate the system graph.
        </p>
      </div>
    </div>
  );
}

function LoadingGraphState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Loading system graph...</p>
      </div>
    </div>
  );
}

function ErrorGraphState({ error }: { error: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-red-400 mb-1">Graph rendering failed</p>
        <p className="text-xs text-zinc-500">{error}</p>
      </div>
    </div>
  );
}

// ── Ready state: transmission layer ─────────────────────────────────

function GraphReadyState({ graph }: { graph: SafeGraph }) {
  const readiness = assessGraphReadiness(graph);
  const displayNodes = readiness.isDense && readiness.suggestedMaxNodes
    ? [...graph.nodes].sort((a, b) => b.stress - a.stress).slice(0, readiness.suggestedMaxNodes)
    : graph.nodes;

  const sectors = groupBySector(displayNodes);
  const sectorKeys = Object.keys(sectors).sort(
    (a, b) => Math.max(...sectors[b].map((n) => n.stress)) - Math.max(...sectors[a].map((n) => n.stress))
  );

  // Show top edges by weight
  const displayEdges = [...graph.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar: stats */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex gap-2">
          <span className="px-2 py-1 text-[10px] font-mono bg-zinc-900/90 border border-zinc-800 rounded text-zinc-400">
            {displayNodes.length} nodes
          </span>
          <span className="px-2 py-1 text-[10px] font-mono bg-zinc-900/90 border border-zinc-800 rounded text-zinc-400">
            {graph.edgeCount} edges
          </span>
          <span className="px-2 py-1 text-[10px] font-mono bg-zinc-900/90 border border-zinc-800 rounded text-zinc-400">
            {sectorKeys.length} sectors
          </span>
        </div>
        {readiness.isDense && readiness.suggestedMaxNodes && (
          <span className="px-2 py-1 text-[10px] bg-amber-950/40 border border-amber-900/40 rounded text-amber-400">
            Dense: showing top {readiness.suggestedMaxNodes}
          </span>
        )}
      </div>

      {/* Main: two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: sector node blocks */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sectorKeys.map((sector) => (
            <div key={sector}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {SECTOR_LABELS[sector] ?? sector}
                </h3>
                <span className="text-[10px] text-zinc-600">{sectors[sector].length}</span>
                <div className="flex-1 h-px bg-zinc-800/60" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {sectors[sector].slice(0, 12).map((node) => (
                  <NodeBlock key={node.id} node={node} />
                ))}
              </div>
              {sectors[sector].length > 12 && (
                <p className="text-[10px] text-zinc-600 mt-1">+{sectors[sector].length - 12} more</p>
              )}
            </div>
          ))}
        </div>

        {/* Right: transmission edges */}
        {displayEdges.length > 0 && (
          <div className="w-[280px] border-l border-zinc-800/60 overflow-y-auto p-3 flex-shrink-0">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Transmission Mechanics
            </h3>
            <p className="text-[10px] text-zinc-600 mb-3">
              Top {displayEdges.length} by propagation weight
            </p>
            <div className="space-y-0.5">
              {displayEdges.map((edge, i) => (
                <TransmissionEdge key={`${edge.source}-${edge.target}-${i}`} edge={edge} nodes={displayNodes} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────

export default function GraphPanel({ graph, panelState, error }: GraphPanelProps) {
  if (panelState === "loading") return <LoadingGraphState />;
  if (panelState === "error") return <ErrorGraphState error={error ?? "Unknown error"} />;
  if (panelState === "empty" || graph.isEmpty) return <EmptyGraphState />;
  return <GraphReadyState graph={graph} />;
}
