"use client";

/**
 * /demo — Executive Demo Flow
 *
 * Isolated presentation layer on top of the existing command center.
 * Vertical storytelling layout. Full-width sections. No sidebar. No nav clutter.
 * Reuses useCommandCenter for data — zero backend changes.
 *
 * Presenter controls: auto-play (2s per step), arrow keys, space to pause, R to replay.
 */

import { useState, useEffect, useMemo } from "react";
import MacroHero from "@/components/demo/MacroHero";
import DemoTransmissionFlow from "@/components/demo/DemoTransmissionFlow";
import DemoDecisionPanel from "@/components/demo/DemoDecisionPanel";
import DemoTrustPanel from "@/components/demo/DemoTrustPanel";
import OptionalDetail from "@/components/demo/OptionalDetail";
import { useCommandCenter } from "@/features/command-center/lib/use-command-center";
import { detectPanelState } from "@/features/command-center/lib/readiness-guards";
import { SCENARIOS, SCENARIO_LABELS, type ScenarioKey } from "@/lib/v2/demo-scenarios";

const MAX_STEP = 6;

export default function DemoPage() {
  const cc = useCommandCenter();
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("hormuz");

  // Reset playback when scenario changes
  useEffect(() => {
    setStep(0);
    setIsPlaying(true);
  }, [activeScenario]);

  // Merge scenario data over command center data
  const scenario = SCENARIOS[activeScenario];
  const data = useMemo(
    () => ({
      ...cc.data,
      event: scenario.event,
      metrics: scenario.metrics,
      decisions: scenario.decisions,
    }),
    [cc.data, scenario],
  );

  // Auto-play: advance every 2s
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setStep((s) => (s >= MAX_STEP ? s : s + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, MAX_STEP));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
      if (e.key === "r") setStep(0);
      if (e.key === " ") { e.preventDefault(); setIsPlaying((p) => !p); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const graphState = detectPanelState({
    isLoading: cc.isLoading,
    error: cc.error,
    hasData: !data.graph.isEmpty,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Minimal top bar */}
      <nav className="bg-zinc-950 border-b border-zinc-800/50 px-8 lg:px-16 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">IO</span>
          </div>
          <span className="text-sm font-semibold text-zinc-300">Impact Observatory</span>
          <span className="text-[10px] text-zinc-600 font-medium">| GCC Decision Intelligence</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeScenario}
            onChange={(e) => setActiveScenario(e.target.value as ScenarioKey)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-600 cursor-pointer"
          >
            {(Object.keys(SCENARIO_LABELS) as ScenarioKey[]).map((key) => (
              <option key={key} value={key}>
                {SCENARIO_LABELS[key]}
              </option>
            ))}
          </select>
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
            cc.source === "live"
              ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
              : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
          }`}>
            {cc.source}
          </span>
          <button
            onClick={() => cc.setSource(cc.source === "mock" ? "live" : "mock")}
            className="px-3 py-1 text-[10px] font-medium text-zinc-500 border border-zinc-800 rounded-lg hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            Toggle Source
          </button>
        </div>
      </nav>

      {/* Loading state */}
      {cc.isLoading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-400">Loading scenario data...</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {cc.error && (
        <div className="mx-8 lg:mx-16 mt-4 px-4 py-3 bg-red-950/50 border border-red-900/50 rounded-lg text-xs text-red-400">
          Live data unavailable: {cc.error} — showing cached/mock data
        </div>
      )}

      {/* ═══ SECTION 1: MacroHero (step 0) ═══ */}
      {step >= 0 && <MacroHero event={data.event} metrics={data.metrics} />}

      {/* ═══ SECTION 2: TransmissionFlow (step 1) ═══ */}
      {step >= 1 && (
        <DemoTransmissionFlow
          event={data.event}
          metrics={data.metrics}
          decisions={data.decisions}
          graph={data.graph}
        />
      )}

      {/* ═══ SECTION 3: DecisionPanel (step 2) ═══ */}
      {step >= 2 && <DemoDecisionPanel decisions={data.decisions} />}

      {/* ═══ SECTION 4: TrustPanel (step 3) ═══ */}
      {step >= 3 && (
        <DemoTrustPanel
          readiness={cc.readiness}
          source={cc.source}
          timestamp={data.event.timestamp}
        />
      )}

      {/* ═══ SECTION 5: OptionalDetail (step 4) ═══ */}
      {step >= 4 && (
        <OptionalDetail
          graph={data.graph}
          graphState={graphState}
          readiness={cc.readiness}
          error={cc.error}
        />
      )}

      {/* Footer (step 5) */}
      {step >= 5 && (
        <footer className="bg-zinc-950 border-t border-zinc-800/50 px-8 lg:px-16 py-4 flex items-center justify-between text-[10px] text-zinc-600">
          <span>Impact Observatory — GCC Decision Intelligence Platform</span>
          <span>Readiness: {cc.readiness.score}% · Source: {cc.source}</span>
        </footer>
      )}

      {/* ═══ Presenter Overlay ═══ */}
      <div className="fixed bottom-6 right-6 bg-black/80 backdrop-blur-sm border border-zinc-700/50 p-4 rounded-xl text-sm space-y-2 z-50">
        <div className="text-zinc-400">Step {step} / {MAX_STEP}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep((s) => Math.min(s + 1, MAX_STEP))}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
          >
            Next →
          </button>
          <button
            onClick={() => setStep(0)}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
          >
            Replay
          </button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              isPlaying
                ? "bg-red-900/60 hover:bg-red-800/60 text-red-300"
                : "bg-emerald-900/60 hover:bg-emerald-800/60 text-emerald-300"
            }`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}
