"use client";

import type { ReadinessVerdict } from "@/features/command-center/lib/readiness-guards";
import type { DataSource } from "@/features/command-center/lib/use-command-center";

interface StatusBarProps {
  readiness: ReadinessVerdict;
  source: DataSource;
  error?: string | null;
  onToggleSource?: () => void;
}

export default function StatusBar({ readiness, source, error, onToggleSource }: StatusBarProps) {
  const scoreColor =
    readiness.score >= 80
      ? "text-emerald-400"
      : readiness.score >= 50
      ? "text-amber-400"
      : "text-red-400";

  return (
    <footer className="bg-zinc-900 border-t border-zinc-800 px-6 py-2 flex items-center justify-between text-[11px]">
      {/* Left: readiness checks */}
      <div className="flex items-center gap-4">
        <span className={`font-bold tabular-nums ${scoreColor}`}>
          Readiness {readiness.score}%
        </span>
        <div className="flex items-center gap-2">
          {readiness.checks.map((c) => (
            <span
              key={c.name}
              className="flex items-center gap-1"
              title={`${c.name}: ${c.detail}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.passed ? "bg-emerald-500" : "bg-zinc-600"}`} />
              <span className="text-zinc-500">{c.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right: source + error */}
      <div className="flex items-center gap-3">
        {error && (
          <span className="text-red-400 truncate max-w-48" title={error}>
            {error}
          </span>
        )}
        <button
          onClick={onToggleSource}
          className={`px-2 py-0.5 rounded font-bold uppercase ${
            source === "live"
              ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
              : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
          }`}
        >
          {source}
        </button>
      </div>
    </footer>
  );
}
