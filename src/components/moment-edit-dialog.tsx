"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

import { Button, FieldLabel, Panel, Select, TextArea, TextInput } from "@/components/ui";
import type { MomentRecord, MomentTypeRecord, UpdateMomentInput } from "@/lib/domain";
import { formatPreciseTime, roundSeconds } from "@/lib/time";

export function MomentEditDialog({
  moment,
  momentTypes,
  currentTime,
  duration = 0,
  onPreview,
  onSave,
  onClose,
}: {
  moment: MomentRecord;
  momentTypes: MomentTypeRecord[];
  currentTime?: number;
  duration?: number;
  onPreview?: (start: number, end: number) => void;
  onSave: (momentId: string, input: UpdateMomentInput) => Promise<void>;
  onClose: () => void;
}) {
  const [momentTypeId, setMomentTypeId] = useState(moment.momentTypeId);
  const [start, setStart] = useState(moment.startTimeSeconds);
  const [end, setEnd] = useState(moment.endTimeSeconds);
  const [notes, setNotes] = useState(moment.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = (value: number) => roundSeconds(Math.max(0, duration ? Math.min(value, duration) : value));
  const change = (target: "start" | "end", amount: number) => target === "start"
    ? setStart((value) => limit(value + amount))
    : setEnd((value) => limit(value + amount));

  async function save() {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError("The end time must be after the start time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(moment.id, {
        momentTypeId,
        startTimeSeconds: limit(start),
        endTimeSeconds: limit(end),
        notes: notes.trim() || null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the moment.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Edit moment">
      <Panel className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[.2em] text-cyan-200/70">Edit moment</p><h2 className="mt-1 text-lg font-semibold text-white">Correct type and clip times</h2></div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X size={17} /></Button>
        </div>
        {error ? <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-100">{error}</p> : null}
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2"><FieldLabel>Type</FieldLabel><Select value={momentTypeId} onChange={(event) => setMomentTypeId(event.target.value)}>{momentTypes.map((type) => <option key={type.id} value={type.id}>{type.code} - {type.name}</option>)}</Select></label>
          {(["start", "end"] as const).map((target) => {
            const value = target === "start" ? start : end;
            const setValue = target === "start" ? setStart : setEnd;
            return <div key={target} className="grid gap-2"><div className="flex items-center justify-between"><FieldLabel>{target === "start" ? "Start" : "End"}</FieldLabel><span className="font-mono text-xs text-slate-400">{formatPreciseTime(value)}</span></div><TextInput type="number" min="0" max={duration || undefined} step="0.1" value={value} onChange={(event) => setValue(Number(event.target.value))} /><div className="flex flex-wrap gap-1">{[-1, -0.1, 0.1, 1].map((amount) => <Button key={amount} type="button" size="sm" variant="secondary" onClick={() => change(target, amount)}>{amount > 0 ? "+" : ""}{amount}s</Button>)}{currentTime !== undefined ? <Button type="button" size="sm" variant="secondary" onClick={() => setValue(limit(currentTime))}>Use current</Button> : null}</div></div>;
          })}
          <label className="grid gap-2"><FieldLabel>Notes</FieldLabel><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Duration: <span className="font-mono text-white">{formatPreciseTime(Math.max(0, end - start))}</span></div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {onPreview ? <Button variant="secondary" onClick={() => onPreview(start, end)} disabled={end <= start}><Play size={15} />Preview</Button> : null}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving" : "Save changes"}</Button>
        </div>
      </Panel>
    </div>
  );
}
