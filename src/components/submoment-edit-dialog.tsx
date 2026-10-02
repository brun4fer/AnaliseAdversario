"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button, FieldLabel, Panel, Select, TextArea, TextInput } from "@/components/ui";
import type { SubMomentRecord, SubMomentTypeRecord, UpdateSubMomentInput } from "@/lib/domain";
import { clamp, formatPreciseTime, roundSeconds } from "@/lib/time";

export function SubmomentEditDialog({
  submoment,
  submomentTypes,
  momentStart,
  momentEnd,
  currentTime,
  onSave,
  onClose,
}: {
  submoment: SubMomentRecord;
  submomentTypes: SubMomentTypeRecord[];
  momentStart: number;
  momentEnd: number;
  currentTime?: number;
  onSave: (submomentId: string, input: UpdateSubMomentInput) => Promise<void>;
  onClose: () => void;
}) {
  const [subMomentTypeId, setSubMomentTypeId] = useState(submoment.subMomentTypeId);
  const [time, setTime] = useState(() => String(roundSeconds(clamp(submoment.timeSeconds ?? currentTime ?? momentStart, momentStart, momentEnd))));
  const [notes, setNotes] = useState(submoment.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeValue = time !== "" && Number.isFinite(Number(time)) ? clamp(Number(time), momentStart, momentEnd) : momentStart;

  function changeTime(seconds: number) {
    setTime(String(roundSeconds(clamp(seconds, momentStart, momentEnd))));
  }

  async function save() {
    const seconds = Number(time);
    if (time === "" || !Number.isFinite(seconds) || seconds < momentStart || seconds > momentEnd) {
      setError(`Choose a time between ${formatPreciseTime(momentStart)} and ${formatPreciseTime(momentEnd)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(submoment.id, {
        subMomentTypeId,
        timeSeconds: seconds,
        notes: notes.trim() || null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the submoment.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Edit submoment">
      <Panel className="max-h-[90vh] w-full max-w-md overflow-y-auto p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Edit submoment</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X size={16} /></Button></div>
        {error ? <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-100">{error}</p> : null}
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2"><FieldLabel>Type</FieldLabel><Select value={subMomentTypeId} onChange={(event) => setSubMomentTypeId(event.target.value)}>{submomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3"><FieldLabel>Time in seconds</FieldLabel><span className="font-mono text-sm text-cyan-100">{formatPreciseTime(timeValue)}</span></div>
            <TextInput type="number" step="0.1" min={momentStart} max={momentEnd} value={time} onChange={(event) => setTime(event.target.value)} />
            <input aria-label="Submoment position in the clip" type="range" step="0.1" min={momentStart} max={momentEnd} value={timeValue} onChange={(event) => changeTime(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-300" />
            <div className="grid grid-cols-3 gap-2"><Button variant="secondary" onClick={() => changeTime(timeValue - 1)}>−1s</Button><Button variant="secondary" disabled={currentTime === undefined} onClick={() => changeTime(currentTime ?? momentStart)}>Use video time</Button><Button variant="secondary" onClick={() => changeTime(timeValue + 1)}>+1s</Button></div>
          </div>
          <label className="grid gap-2"><FieldLabel>Notes</FieldLabel><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button></div>
      </Panel>
    </div>
  );
}
