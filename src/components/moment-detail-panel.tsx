"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Goal, Save, Trash2 } from "lucide-react";

import type {
  MomentRecord,
  MomentTypeRecord,
  SubMomentRecord,
  SubMomentTypeRecord,
  UpdateMomentInput,
} from "@/lib/domain";
import { formatPreciseTime } from "@/lib/time";
import { Button, FieldLabel, Panel, Select, TextArea, TextInput, Badge } from "@/components/ui";
import { GoalTarget, TacticalField } from "@/components/tactical-surfaces";

type Point = {
  x: number;
  y: number;
};

type MomentDetailPanelProps = {
  moment: MomentRecord;
  momentTypes: MomentTypeRecord[];
  subMomentTypes: SubMomentTypeRecord[];
  currentTime: number;
  saveSignal: number;
  onSave: (momentId: string, input: UpdateMomentInput) => Promise<void>;
  onDelete: (momentId: string) => Promise<void>;
  onAddSubMoment: (input: {
    momentId: string;
    subMomentTypeId: string;
    timeSeconds: number | null;
    fieldX: number | null;
    fieldY: number | null;
    goalX: number | null;
    goalY: number | null;
    notes: string | null;
  }) => Promise<void>;
  onDeleteSubMoment: (subMomentId: string) => Promise<void>;
};

export function MomentDetailPanel({
  moment,
  momentTypes,
  subMomentTypes,
  currentTime,
  saveSignal,
  onSave,
  onDelete,
  onAddSubMoment,
  onDeleteSubMoment,
}: MomentDetailPanelProps) {
  const [momentTypeId, setMomentTypeId] = useState(moment.momentTypeId);
  const [start, setStart] = useState(String(moment.startTimeSeconds));
  const [end, setEnd] = useState(String(moment.endTimeSeconds));
  const [notes, setNotes] = useState(moment.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [subMomentTypeId, setSubMomentTypeId] = useState(subMomentTypes[0]?.id ?? "");
  const [subMomentTime, setSubMomentTime] = useState("");
  const [subMomentNotes, setSubMomentNotes] = useState("");
  const [fieldPoint, setFieldPoint] = useState<Point | null>(null);
  const [goalPoint, setGoalPoint] = useState<Point | null>(null);
  const lastSaveSignal = useRef(saveSignal);

  const selectedSubMomentType = useMemo(
    () => subMomentTypes.find((type) => type.id === subMomentTypeId) ?? subMomentTypes[0],
    [subMomentTypeId, subMomentTypes],
  );

  useEffect(() => {
    setMomentTypeId(moment.momentTypeId);
    setStart(String(moment.startTimeSeconds));
    setEnd(String(moment.endTimeSeconds));
    setNotes(moment.notes ?? "");
  }, [moment]);

  useEffect(() => {
    if (saveSignal === lastSaveSignal.current) {
      return;
    }

    lastSaveSignal.current = saveSignal;
    void saveMoment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  async function saveMoment() {
    setSaving(true);
    try {
      await onSave(moment.id, {
        momentTypeId,
        startTimeSeconds: Number(start),
        endTimeSeconds: Number(end),
        notes,
      });
    } finally {
      setSaving(false);
    }
  }

  async function addSubMoment() {
    if (!selectedSubMomentType) {
      return;
    }

    await onAddSubMoment({
      momentId: moment.id,
      subMomentTypeId: selectedSubMomentType.id,
      timeSeconds: subMomentTime ? Number(subMomentTime) : null,
      fieldX: fieldPoint?.x ?? null,
      fieldY: fieldPoint?.y ?? null,
      goalX: selectedSubMomentType.requiresGoalLocation ? goalPoint?.x ?? null : null,
      goalY: selectedSubMomentType.requiresGoalLocation ? goalPoint?.y ?? null : null,
      notes: subMomentNotes || null,
    });

    setSubMomentNotes("");
    setSubMomentTime("");
    setFieldPoint(null);
    setGoalPoint(null);
  }

  const existingFieldMarkers = moment.subMoments
    .filter((subMoment) => subMoment.fieldX !== null && subMoment.fieldY !== null)
    .map((subMoment) => ({ x: subMoment.fieldX as number, y: subMoment.fieldY as number }));

  const existingGoalMarkers = moment.subMoments
    .filter((subMoment) => subMoment.goalX !== null && subMoment.goalY !== null)
    .map((subMoment) => ({ x: subMoment.goalX as number, y: subMoment.goalY as number }));

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge style={{ borderColor: `${moment.momentType.color}66`, color: moment.momentType.color }}>
              {moment.momentType.code}
            </Badge>
            <span className="text-sm text-slate-400">
              {formatPreciseTime(moment.startTimeSeconds)} - {formatPreciseTime(moment.endTimeSeconds)}
            </span>
          </div>
          <h2 className="mt-2 truncate text-lg font-semibold text-white">Detalhe do momento</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void saveMoment()} disabled={saving}>
            <Save size={16} />
            {saving ? "A guardar" : "Guardar"}
          </Button>
          <Button variant="danger" onClick={() => void onDelete(moment.id)}>
            <Trash2 size={16} />
            Apagar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[26rem_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <FieldLabel>Tipo</FieldLabel>
              <Select value={momentTypeId} onChange={(event) => setMomentTypeId(event.target.value)}>
                {momentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} · {type.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <FieldLabel>Duração</FieldLabel>
              <div className="flex h-10 items-center rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-300">
                {formatPreciseTime(Math.max(0, Number(end) - Number(start)))}
              </div>
            </div>
            <div className="grid gap-2">
              <FieldLabel>Início</FieldLabel>
              <TextInput type="number" step="0.1" min="0" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <FieldLabel>Fim</FieldLabel>
              <TextInput type="number" step="0.1" min="0" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <FieldLabel>Notas</FieldLabel>
            <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>Campo</FieldLabel>
                <span className="text-xs text-slate-500">
                  {fieldPoint ? `${fieldPoint.x}%, ${fieldPoint.y}%` : "Clique no campo"}
                </span>
              </div>
              <TacticalField value={fieldPoint} markers={existingFieldMarkers} onChange={setFieldPoint} />
            </div>

            {selectedSubMomentType?.requiresGoalLocation ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Baliza</FieldLabel>
                  <span className="text-xs text-slate-500">
                    {goalPoint ? `${goalPoint.x}%, ${goalPoint.y}%` : "Clique na baliza"}
                  </span>
                </div>
                <GoalTarget value={goalPoint} markers={existingGoalMarkers} onChange={setGoalPoint} />
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-black/15 p-3">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <FieldLabel>Submomento</FieldLabel>
                  <Select value={subMomentTypeId} onChange={(event) => setSubMomentTypeId(event.target.value)}>
                    {subMomentTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="grid gap-2">
                    <FieldLabel>Tempo opcional</FieldLabel>
                    <TextInput
                      type="number"
                      step="0.1"
                      min="0"
                      value={subMomentTime}
                      onChange={(event) => setSubMomentTime(event.target.value)}
                      placeholder={formatPreciseTime(currentTime)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={() => setSubMomentTime(String(Math.round(currentTime * 10) / 10))}>
                      Usar atual
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <FieldLabel>Nota</FieldLabel>
                  <TextArea value={subMomentNotes} onChange={(event) => setSubMomentNotes(event.target.value)} />
                </div>
                <Button type="button" variant="primary" onClick={() => void addSubMoment()}>
                  <Crosshair size={16} />
                  Adicionar submomento
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Submomentos guardados</FieldLabel>
              {moment.subMoments.length === 0 ? (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                  Ainda não existem submomentos neste excerto.
                </p>
              ) : (
                moment.subMoments.map((subMoment) => (
                  <SubMomentItem key={subMoment.id} subMoment={subMoment} onDelete={onDeleteSubMoment} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SubMomentItem({
  subMoment,
  onDelete,
}: {
  subMoment: SubMomentRecord;
  onDelete: (subMomentId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{subMoment.subMomentType.name}</Badge>
            {subMoment.timeSeconds !== null ? <span className="text-xs text-slate-500">{formatPreciseTime(subMoment.timeSeconds)}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {subMoment.fieldX !== null && subMoment.fieldY !== null ? (
              <span className="inline-flex items-center gap-1">
                <Crosshair size={12} /> {subMoment.fieldX}%, {subMoment.fieldY}%
              </span>
            ) : null}
            {subMoment.goalX !== null && subMoment.goalY !== null ? (
              <span className="inline-flex items-center gap-1">
                <Goal size={12} /> {subMoment.goalX}%, {subMoment.goalY}%
              </span>
            ) : null}
          </div>
          {subMoment.notes ? <p className="mt-2 text-sm text-slate-300">{subMoment.notes}</p> : null}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Apagar submomento"
          onClick={() => {
            if (window.confirm("Apagar este submomento?")) {
              void onDelete(subMoment.id);
            }
          }}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}
