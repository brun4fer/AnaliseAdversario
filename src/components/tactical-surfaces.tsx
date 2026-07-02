"use client";

import { MouseEvent } from "react";

import { cn } from "@/lib/cn";

type Point = {
  x: number;
  y: number;
};

export type SurfaceMarker = Point & {
  id?: string;
  label?: string;
  detail?: string;
  active?: boolean;
};

type SurfaceProps = {
  value: Point | null;
  onChange: (point: Point) => void;
  className?: string;
  markers?: SurfaceMarker[];
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

function getMarkerTitle(marker: SurfaceMarker) {
  return [marker.label, marker.detail].filter(Boolean).join(" - ");
}

function MarkerDot({ marker, current }: { marker: SurfaceMarker; current: boolean }) {
  const title = getMarkerTitle(marker);

  return (
    <span
      data-marker="true"
      className="group absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      title={title || undefined}
    >
      <span
        className={cn(
          "absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)] transition",
          current && "h-4 w-4 bg-emerald-300 shadow-[0_0_22px_rgba(110,231,183,0.9)]",
          marker.active && "h-5 w-5 border-amber-100 bg-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.95)]",
        )}
      />
      {title ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 min-w-32 max-w-56 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-pitch-950 px-2 py-1 text-center text-[11px] font-medium leading-4 text-slate-100 opacity-0 shadow-xl transition group-hover:opacity-100">
          {title}
        </span>
      ) : null}
    </span>
  );
}

export function TacticalField({ value, onChange, className, markers = [] }: SurfaceProps) {
  const visibleMarkers: SurfaceMarker[] = [...markers, ...(value ? [{ ...value, active: true }] : [])];

  return (
    <button
      type="button"
      className={cn(
        "field-grid relative aspect-[16/10] w-full overflow-visible rounded-lg border border-emerald-300/30 bg-pitch-800 text-left shadow-inner",
        className,
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-marker='true']")) {
          return;
        }
        onChange(getPointFromEvent(event));
      }}
      aria-label="Campo de futebol horizontal"
    >
      <span className="absolute inset-y-[8%] left-[4%] w-[13%] border border-white/35" />
      <span className="absolute inset-y-[24%] left-[4%] w-[6%] border border-white/25" />
      <span className="absolute inset-y-[8%] right-[4%] w-[13%] border border-white/35" />
      <span className="absolute inset-y-[24%] right-[4%] w-[6%] border border-white/25" />
      <span className="absolute left-1/2 top-0 h-full w-px bg-white/35" />
      <span className="absolute left-1/2 top-1/2 h-[24%] w-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
      {visibleMarkers.map((marker, index) => (
        <MarkerDot key={marker.id ?? `${marker.x}-${marker.y}-${index}`} marker={marker} current={index >= markers.length} />
      ))}
    </button>
  );
}

export function GoalTarget({ value, onChange, className, markers = [] }: SurfaceProps) {
  const visibleMarkers: SurfaceMarker[] = [...markers, ...(value ? [{ ...value, active: true }] : [])];

  return (
    <button
      type="button"
      className={cn(
        "relative aspect-[16/7] w-full overflow-visible rounded-lg border border-cyan-300/30 bg-gradient-to-b from-slate-900 to-pitch-900 text-left shadow-inner",
        className,
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-marker='true']")) {
          return;
        }
        onChange(getPointFromEvent(event));
      }}
      aria-label="Baliza interativa"
    >
      <span className="absolute inset-x-[8%] bottom-[14%] top-[14%] border-2 border-white/65" />
      <span className="absolute inset-x-[8%] bottom-[14%] top-[14%] bg-[linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:12.5%_100%,100%_25%]" />
      {visibleMarkers.map((marker, index) => (
        <MarkerDot key={marker.id ?? `${marker.x}-${marker.y}-${index}`} marker={marker} current={index >= markers.length} />
      ))}
    </button>
  );
}
