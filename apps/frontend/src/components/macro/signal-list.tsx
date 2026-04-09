/**
 * SignalList — Displays macro signals with strength bars and direction indicators
 * IO design system
 */

interface Signal {
  name: string;
  strength: number;
  direction: "up" | "down" | "neutral";
  description: string;
  description_ar: string;
}

interface SignalListProps {
  signals: Signal[];
  title?: string;
  titleAr?: string;
  locale?: "en" | "ar";
  maxItems?: number;
}

const DIR_ICON: Record<string, string> = { up: "↑", down: "↓", neutral: "→" };
const DIR_COLOR: Record<string, string> = {
  up: "text-io-danger",
  down: "text-io-success",
  neutral: "text-io-secondary",
};
const BAR_COLOR: Record<string, string> = {
  up: "bg-io-danger",
  down: "bg-io-success",
  neutral: "bg-io-secondary",
};

export function SignalList({
  signals,
  title,
  titleAr,
  locale = "en",
  maxItems,
}: SignalListProps) {
  const isRtl = locale === "ar";
  const items = maxItems ? signals.slice(0, maxItems) : signals;

  return (
    <div className="space-y-2.5">
      {title && (
        <h4 className="text-xs font-semibold text-io-secondary uppercase tracking-wider mb-3">
          {isRtl && titleAr ? titleAr : title}
        </h4>
      )}
      {items.length === 0 && (
        <p className="text-sm text-io-secondary text-center py-4">
          {isRtl ? "لا توجد إشارات نشطة" : "No active signals"}
        </p>
      )}
      {items.map((signal) => (
        <div
          key={signal.name}
          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-io-bg transition-colors"
        >
          <span className={`text-base font-bold ${DIR_COLOR[signal.direction]}`}>
            {DIR_ICON[signal.direction]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-io-primary truncate">
              {signal.name.replace(/_/g, " ")}
            </p>
            <p className="text-[11px] text-io-secondary truncate">
              {isRtl ? signal.description_ar : signal.description}
            </p>
          </div>
          <div className="w-20 flex-shrink-0">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${BAR_COLOR[signal.direction]}`}
                style={{ width: `${signal.strength * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-io-secondary text-right mt-0.5 tabular-nums">
              {(signal.strength * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SignalList;
