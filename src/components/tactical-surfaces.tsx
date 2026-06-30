"use client";

import { MouseEvent } from "react";

import { cn } from "@/lib/cn";

type Point = {
  x: number;
  y: number;
};

type SurfaceProps = {
  value: Point | null;
  onChange: (point: Point) => void;
  className?: string;
  markers?: Point[];
};

function getPointFromEvent(event: MouseEvent<HTMLButtonElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.round(Math.min(100, Math.max(0, x)) * 10) / 10,
    y: Math.round(Math.min(100, Math.max(0, y)) * 10) / 10,
  };
}

export function TacticalField({ value, onChange, className, markers = [] }: SurfaceProps) {
  return (
    <button
      type="button"
      className={cn(
        "field-grid relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-emerald-300/30 bg-pitch-800 text-left shadow-inner",
        className,
      )}
      onClick={(event) => onChange(getPointFromEvent(event))}
      aria-label="Campo de futebol horizontal"
    >
      <span className="absolute inset-y-[8%] left-[4%] w-[13%] border border-white/35" />
      <span className="absolute inset-y-[24%] left-[4%] w-[6%] border border-white/25" />
      <span className="absolute inset-y-[8%] right-[4%] w-[13%] border border-white/35" />
      <span className="absolute inset-y-[24%] right-[4%] w-[6%] border border-white/25" />
      <span className="absolute left-1/2 top-0 h-full w-px bg-white/35" />
      <span className="absolute left-1/2 top-1/2 h-[24%] w-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
      {[...markers, ...(value ? [value] : [])].map((marker, index) => (
        <span
          key={`${marker.x}-${marker.y}-${index}`}
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]",
            index >= markers.length && "h-4 w-4 bg-emerald-300",
          )}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        />
      ))}
    </button>
  );
}

export function GoalTarget({ value, onChange, className, markers = [] }: SurfaceProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-cyan-300/30 bg-gradient-to-b from-slate-900 to-pitch-900 text-left shadow-inner",
        className,
      )}
      onClick={(event) => onChange(getPointFromEvent(event))}
      aria-label="Baliza interativa"
    >
      <span className="absolute inset-x-[8%] bottom-[14%] top-[14%] border-2 border-white/65" />
      <span className="absolute inset-x-[8%] bottom-[14%] top-[14%] bg-[linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:12.5%_100%,100%_25%]" />
      {[...markers, ...(value ? [value] : [])].map((marker, index) => (
        <span
          key={`${marker.x}-${marker.y}-${index}`}
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]",
            index >= markers.length && "h-4 w-4 bg-emerald-300",
          )}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        />
      ))}
    </button>
  );
}
