"use client";

/**
 * Demo: TrustPanel
 * Confidence score, quality checks, audit hash, data timestamp.
 */

import type { ReadinessVerdict } from "@/features/command-center/lib/readiness-guards";
import type { DataSource } from "@/features/command-center/lib/use-command-center";
import { safeNumber } from "./demo-helpers";

interface DemoTrustPanelProps {
  readiness: ReadinessVerdict;
  source: DataSource;
  timestamp: string;
}

function deriveAuditHash(ts: string): string {
  let h = 0;
  for (let i = 0; i < ts.length; i++) {
    h = ((h << 5) - h + ts.charCodeAt(i)) | 0;
  }
  return `0x${Math.abs(h).toString(16).padStart(8, "0").toUpperCase()}`;
}

export default function DemoTrustPanel({ readiness, source, timestamp }: DemoTrustPanelProps) {
  const score = safeNumber(readiness.score, 0);
  const scoreColor =
    score >= 80 ? "text-emerald-400" :
    score >= 50 ? "text-amber-400" :
    "text-red-400";

  const checks = readiness.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const auditHash = deriveAuditHash(timestamp || new Date().toISOString());

  return (
    <section className="bg-zinc-950 border-b border-zinc-800 px-8 lg:px-16 py-10">
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-medium mb-1">
        Trust & Confidence
      </p>
      <p className="text-xs text-zinc-500 mb-6">Quality checks and audit trail</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Score */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Trust Score</p>
          <p className={`text-6xl font-black tabular-nums ${scoreColor}`}>{score}%</p>
          <p className="text-xs text-zinc-500 mt-2">
            {passed}/{checks.length} checks passed
          </p>
        </div>

        {/* Checks */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4">Quality Checks</p>
          <div className="space-y-2.5">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.passed ? "bg-emerald-500" : "bg-zinc-600"}`} />
                  <span className="text-xs text-zinc-300">{c.name}</span>
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4">Audit Trail</p>
          <div className="space-y-3">
            <AuditRow label="Source" value={source.toUpperCase()} />
            <AuditRow label="Audit Hash" value={auditHash} mono />
            <AuditRow
              label="Timestamp"
              value={timestamp
                ? new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"
              }
            />
            <AuditRow label="Readiness" value={`${score}%`} />
          </div>
        </div>
      </div>
    </section>
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
