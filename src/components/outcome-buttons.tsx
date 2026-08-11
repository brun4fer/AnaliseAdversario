import { Circle } from "lucide-react";

import { cn } from "@/lib/cn";

type Outcome = "positive" | "negative" | null;

export function OutcomeButtons({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: Outcome;
  onChange: (outcome: Exclude<Outcome, null>) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label="Result classification">
      <button
        type="button"
        aria-label="Mark as positive"
        aria-pressed={value === "positive"}
        title="Positive"
        disabled={disabled}
        className={cn(
          "flex items-center justify-center rounded-md border transition duration-150 disabled:opacity-50",
          compact ? "h-6 w-6" : "h-7 w-7",
          value === "positive"
            ? "scale-105 border-emerald-200 bg-emerald-400 text-emerald-950 shadow-[0_0_16px_rgba(52,211,153,0.7)]"
            : "border-emerald-400/35 bg-emerald-400/10 text-emerald-300/75 hover:border-emerald-300 hover:bg-emerald-400/25 hover:text-emerald-200",
        )}
        onClick={() => onChange("positive")}
      >
        <Circle size={compact ? 12 : 14} className="fill-current" />
      </button>
      <button
        type="button"
        aria-label="Mark as negative"
        aria-pressed={value === "negative"}
        title="Negative"
        disabled={disabled}
        className={cn(
          "flex items-center justify-center rounded-md border transition duration-150 disabled:opacity-50",
          compact ? "h-6 w-6" : "h-7 w-7",
          value === "negative"
            ? "scale-105 border-red-200 bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.72)]"
            : "border-red-400/35 bg-red-500/10 text-red-300/75 hover:border-red-300 hover:bg-red-500/25 hover:text-red-200",
        )}
        onClick={() => onChange("negative")}
      >
        <Circle size={compact ? 12 : 14} className="fill-current" />
      </button>
    </div>
  );
}
