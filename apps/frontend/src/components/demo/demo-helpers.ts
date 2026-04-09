/**
 * Demo layer — shared safe helpers.
 * Every numeric access in the demo layer must go through safeNumber.
 */

export function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function formatUsd(v: unknown): string {
  const n = safeNumber(v, 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export function pct(v: unknown, fallback = 0): number {
  return Math.round(safeNumber(v, fallback) * 100);
}
