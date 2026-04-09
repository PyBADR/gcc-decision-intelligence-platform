/**
 * MacroCard — Reusable metric card for macro indicators
 * IO design system: boardroom aesthetic, premium cards, tabular-nums
 */

interface MacroCardProps {
  title: string;
  titleAr?: string;
  value: string | number;
  unit?: string;
  change?: number;
  state?: "critical_high" | "high" | "normal" | "low" | "critical_low";
  locale?: "en" | "ar";
}

const STATE_STYLES: Record<string, string> = {
  critical_high: "border-io-danger/30 bg-red-50",
  high: "border-io-warning/30 bg-amber-50",
  normal: "border-io-border bg-white",
  low: "border-io-success/30 bg-green-50",
  critical_low: "border-io-danger/30 bg-red-50",
};

const STATE_DOT: Record<string, string> = {
  critical_high: "bg-io-danger",
  high: "bg-io-warning",
  normal: "bg-io-nominal",
  low: "bg-io-success",
  critical_low: "bg-io-danger",
};

export function MacroCard({
  title,
  titleAr,
  value,
  unit,
  change,
  state = "normal",
  locale = "en",
}: MacroCardProps) {
  const isRtl = locale === "ar";
  const style = STATE_STYLES[state] ?? STATE_STYLES.normal;
  const dot = STATE_DOT[state] ?? STATE_DOT.normal;

  return (
    <div className={`p-4 rounded-xl border shadow-sm transition-shadow hover:shadow-md ${style}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-io-secondary uppercase tracking-wider">
          {isRtl && titleAr ? titleAr : title}
        </span>
        <div className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-io-primary">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs text-io-secondary">{unit}</span>}
      </div>
      {change !== undefined && change !== 0 && (
        <p className={`text-[11px] mt-1.5 font-medium ${
          change > 0 ? "text-io-danger" : "text-io-success"
        }`}>
          {change > 0 ? "+" : ""}{change.toFixed(1)}% {isRtl ? "من الأساس" : "from baseline"}
        </p>
      )}
    </div>
  );
}

export default MacroCard;
