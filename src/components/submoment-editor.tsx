"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileVideo, ListVideo, Pause, Pencil, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge, Button, FieldLabel, Panel, Select, TextInput } from "@/components/ui";
import type { MatchDetail, MomentRecord, SettingsPayload, SubMomentRecord, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getSubMomentTypesForMoment } from "@/lib/taxonomy";
import { formatPreciseTime } from "@/lib/time";

export function SubmomentEditor({ matchId }: { matchId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [filterId, setFilterId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingType, setPendingType] = useState<SubMomentTypeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringVideo, setRestoringVideo] = useState(true);
  const [editingSubmoment, setEditingSubmoment] = useState<SubMomentRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState("");
  const [editTime, setEditTime] = useState("");
  const [managingType, setManagingType] = useState<SubMomentTypeRecord | "new" | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchData, settingsData]) => { const firstTypeId = settingsData.momentTypes[0]?.id || ""; setMatch(matchData); setSettings(settingsData); setFilterId(firstTypeId); setSelectedId(matchData.moments.find((moment) => moment.momentTypeId === firstTypeId)?.id || null); })
      .catch((err: Error) => setError(err.message));
  }, [matchId]);

  useEffect(() => {
    getRememberedMatchVideo(matchId)
      .then((file) => { if (file) setSourceUrl(URL.createObjectURL(file)); })
      .catch(() => undefined)
      .finally(() => setRestoringVideo(false));
  }, [matchId]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const moments = useMemo(() => (match?.moments || []).filter((moment) => moment.momentTypeId === filterId), [filterId, match?.moments]);
  const selectedIndex = moments.findIndex((moment) => moment.id === selectedId);
  const selectedMoment = selectedIndex >= 0 ? moments[selectedIndex] : moments[0] || null;
  const availableSubmoments = useMemo(() => getSubMomentTypesForMoment(settings?.subMomentTypes || [], selectedMoment?.momentType || null), [selectedMoment?.momentType, settings?.subMomentTypes]);

  function selectMoment(moment: MomentRecord, play = false) {
    setSelectedId(moment.id); setPendingType(null);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = moment.startTimeSeconds;
    if (play) void video.play(); else video.pause();
  }

  function changeFilter(nextFilterId: string) {
    const first = match?.moments.find((moment) => moment.momentTypeId === nextFilterId) || null;
    setFilterId(nextFilterId); setSelectedId(first?.id || null); setContinuous(false); setPendingType(null);
    if (first && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = first.startTimeSeconds; }
  }

  function togglePlayback() {
    const video = videoRef.current; if (!video || !selectedMoment) return;
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime < selectedMoment.startTimeSeconds || video.currentTime >= selectedMoment.endTimeSeconds) video.currentTime = selectedMoment.startTimeSeconds;
    void video.play();
  }

  function startAll() {
    if (!sourceUrl || moments.length === 0) return;
    setContinuous(true); selectMoment(moments[0], true);
  }

  function handleTimeUpdate() {
    const video = videoRef.current; if (!video || !selectedMoment) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime < selectedMoment.endTimeSeconds - 0.04) return;
    if (continuous && selectedIndex < moments.length - 1) selectMoment(moments[selectedIndex + 1], true);
    else { video.pause(); setContinuous(false); video.currentTime = selectedMoment.endTimeSeconds; }
  }

  function chooseType(type: SubMomentTypeRecord) {
    videoRef.current?.pause(); setContinuous(false); setPendingType(type);
  }

  async function saveSubmoment() {
    if (!selectedMoment || !pendingType) return;
    setSaving(true); setError(null);
    try {
      const saved = await apiFetch<SubMomentRecord>(`/api/moments/${selectedMoment.id}/submoments`, { method: "POST", body: JSON.stringify({ subMomentTypeId: pendingType.id, timeSeconds: Math.min(selectedMoment.endTimeSeconds, Math.max(selectedMoment.startTimeSeconds, currentTime)), fieldX: null, fieldY: null, goalX: null, goalY: null }) });
      setMatch((current) => current ? { ...current, moments: current.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: [...moment.subMoments, saved] } : moment) } : current);
      setPendingType(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the submoment."); }
    finally { setSaving(false); }
  }

  async function deleteSubmoment(id: string) {
    if (!selectedMoment || !confirm("Delete this submoment?")) return;
    await apiFetch(`/api/submoments/${id}`, { method: "DELETE" });
    setMatch((current) => current ? { ...current, moments: current.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: moment.subMoments.filter((sub) => sub.id !== id) } : moment) } : current);
  }

  function editSubmoment(submoment: SubMomentRecord) {
    setEditingSubmoment(submoment);
    setEditTypeId(submoment.subMomentTypeId);
    setEditTime(submoment.timeSeconds === null ? "" : String(submoment.timeSeconds));
  }

  async function saveEditedSubmoment() {
    if (!editingSubmoment || !selectedMoment) return;
    const seconds = Number(editTime);
    if (!editTypeId || editTime === "" || !Number.isFinite(seconds) || seconds < selectedMoment.startTimeSeconds || seconds > selectedMoment.endTimeSeconds) {
      setError(`Choose a time between ${formatPreciseTime(selectedMoment.startTimeSeconds)} and ${formatPreciseTime(selectedMoment.endTimeSeconds)}.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      const saved = await apiFetch<SubMomentRecord>(`/api/submoments/${editingSubmoment.id}`, { method: "PATCH", body: JSON.stringify({ subMomentTypeId: editTypeId, timeSeconds: seconds }) });
      setMatch((current) => current ? { ...current, moments: current.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: moment.subMoments.map((sub) => sub.id === saved.id ? saved : sub) } : moment) } : current);
      setEditingSubmoment(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update the submoment."); }
    finally { setSaving(false); }
  }

  function openNewType() {
    const prefix = availableSubmoments[0]?.code.split("_")[0] || selectedMoment?.momentType.code || "SUB";
    setManagingType("new"); setTypeName(""); setTypeCode(`${prefix}_`);
  }

  function openEditType(type: SubMomentTypeRecord) {
    setManagingType(type); setTypeName(type.name); setTypeCode(type.code);
  }

  async function saveManagedType() {
    if (!settings || !typeName.trim() || !typeCode.trim()) return;
    setSaving(true); setError(null);
    try {
      const saved = managingType === "new"
        ? await apiFetch<SubMomentTypeRecord>("/api/settings/submoment-types", { method: "POST", body: JSON.stringify({ name: typeName, code: typeCode }) })
        : await apiFetch<SubMomentTypeRecord>(`/api/settings/submoment-types/${managingType?.id}`, { method: "PATCH", body: JSON.stringify({ name: typeName, code: typeCode }) });
      setSettings({ ...settings, subMomentTypes: managingType === "new" ? [...settings.subMomentTypes, saved] : settings.subMomentTypes.map((type) => type.id === saved.id ? saved : type) });
      setManagingType(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the submoment type."); }
    finally { setSaving(false); }
  }

  async function deleteType(type: SubMomentTypeRecord) {
    if (!settings || !confirm(`Delete submoment type ${type.name}?`)) return;
    setError(null);
    try {
      await apiFetch<void>(`/api/settings/submoment-types/${type.id}`, { method: "DELETE" });
      setSettings({ ...settings, subMomentTypes: settings.subMomentTypes.filter((item) => item.id !== type.id) });
      setPendingType((current) => current?.id === type.id ? null : current);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete the submoment type."); }
  }

  function loadVideo(file?: File) {
    if (!file) return; if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file)); void rememberMatchVideo(matchId, file).catch(() => setError("The video was opened, but the browser does not have enough space to keep it between pages.")); setError(match?.video && file.name !== match.video.fileName ? `You selected “${file.name}”; this match expects “${match.video.fileName}”. Confirm that this is the correct file.` : null);
  }

  if (error && !match) return <Panel className="p-5 text-red-100">{error}</Panel>;
  if (!match || !settings) return <div className="h-[70vh] animate-pulse rounded-lg bg-white/[.04]" />;

  return <div className="space-y-4">
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(event) => loadVideo(event.target.files?.[0])} />
    <header className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[.045] p-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`/analysis/${matchId}`} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ArrowLeft size={13} /> Back to tagging</Link><h1 className="text-2xl font-semibold text-white">Submoment editing</h1><p className="mt-1 text-sm text-slate-400">{match.title}</p></div><Button variant="secondary" onClick={() => inputRef.current?.click()}><Upload size={16} />Select local video</Button></header>
    <Panel className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between"><label className="grid min-w-72 gap-2"><FieldLabel>Filter moments</FieldLabel><Select value={filterId} onChange={(event) => changeFilter(event.target.value)}>{settings.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({match.moments.filter((moment) => moment.momentTypeId === type.id).length})</option>)}</Select></label><Button variant="primary" onClick={startAll} disabled={!sourceUrl || moments.length === 0}><ListVideo size={16} />Play all continuously ({moments.length})</Button></Panel>
    {error && <div className="rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div>}
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-slate-500">Identification</p><p className="mt-1 text-sm text-slate-300">Manage submoment buttons</p></div><Button size="sm" variant="primary" onClick={openNewType}><Plus size={14} />Add submoment</Button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{availableSubmoments.map((type) => <div key={type.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1"><Button size="sm" variant={pendingType?.id === type.id ? "primary" : "secondary"} onClick={() => chooseType(type)}>{type.name}</Button><Button size="icon" variant="secondary" aria-label={`Edit ${type.name}`} onClick={() => openEditType(type)}><Pencil size={13} /></Button><Button size="icon" variant="danger" aria-label={`Delete ${type.name}`} onClick={() => void deleteType(type)}><Trash2 size={13} /></Button></div>)}</div>
    </Panel>
    {managingType ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><Panel className="w-full max-w-md p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{managingType === "new" ? "Add submoment" : "Edit submoment type"}</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setManagingType(null)}><X size={16} /></Button></div><div className="mt-4 grid gap-4"><label className="grid gap-2"><FieldLabel>Name</FieldLabel><TextInput value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Submoment name" /></label><label className="grid gap-2"><FieldLabel>Code</FieldLabel><TextInput value={typeCode} onChange={(event) => setTypeCode(event.target.value.toUpperCase())} placeholder="TYPE_CODE" /></label></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setManagingType(null)}>Cancel</Button><Button variant="primary" disabled={saving || !typeName.trim() || !typeCode.trim()} onClick={() => void saveManagedType()}>{saving ? "Saving…" : "Save"}</Button></div></Panel></div> : null}
    <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_24rem]">
      <Panel className="max-h-[44rem] overflow-y-auto"><div className="sticky top-0 border-b border-white/10 bg-pitch-950 p-3 text-xs uppercase tracking-[.18em] text-slate-500">Clips ({moments.length})</div>{moments.length === 0 ? <p className="p-4 text-sm text-slate-400">There are no moments of this type.</p> : moments.map((moment, index) => <button key={moment.id} onClick={() => selectMoment(moment)} className={`flex w-full items-center gap-3 border-b border-white/[.06] p-3 text-left hover:bg-white/[.06] ${selectedMoment?.id === moment.id ? "bg-cyan-300/10" : ""}`}><span className="font-mono text-xs text-slate-500">{index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm text-white">{formatPreciseTime(moment.startTimeSeconds)} – {formatPreciseTime(moment.endTimeSeconds)}</span><span className="text-xs text-cyan-100">{moment.subMoments.length} submoments</span></span></button>)}</Panel>
      <div className="space-y-3"><Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} className="h-full w-full" playsInline onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /> : <div className="flex h-full flex-col items-center justify-center text-center"><FileVideo size={52} className="text-cyan-200" /><p className="mt-3 text-sm text-slate-400">{restoringVideo ? "Restoring the local video…" : "Select the local video for this match."}</p></div>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3"><div className="flex gap-2"><Button size="icon" disabled={selectedIndex <= 0} onClick={() => selectMoment(moments[selectedIndex - 1])}><ChevronLeft /></Button><Button size="icon" variant="primary" disabled={!sourceUrl || !selectedMoment} onClick={togglePlayback}>{isPlaying ? <Pause /> : <Play />}</Button><Button size="icon" disabled={selectedIndex < 0 || selectedIndex >= moments.length - 1} onClick={() => selectMoment(moments[selectedIndex + 1])}><ChevronRight /></Button></div><span className="font-mono text-sm text-slate-300">{formatPreciseTime(currentTime)} {continuous ? "· continuous playback" : ""}</span></div></Panel></div>
      <Panel className="p-4"><p className="text-xs uppercase tracking-[.18em] text-slate-500">Identification</p>{!selectedMoment ? <p className="mt-4 text-sm text-slate-400">Select a clip.</p> : <><div className="mt-3 grid grid-cols-2 gap-2">{availableSubmoments.map((type) => <Button key={type.id} size="sm" variant={pendingType?.id === type.id ? "primary" : "secondary"} onClick={() => chooseType(type)}>{type.name}</Button>)}</div>{pendingType && <div className="mt-4 border-t border-white/10 pt-4"><p className="mb-3 text-xs text-slate-400">The submoment will be saved at {formatPreciseTime(currentTime)}.</p><Button className="w-full" variant="primary" disabled={saving} onClick={() => void saveSubmoment()}><Check size={16} />{saving ? "Saving…" : `Save ${pendingType.name}`}</Button></div>}<div className="mt-5 border-t border-white/10 pt-4"><div className="mb-2 flex justify-between"><FieldLabel>Saved</FieldLabel><span className="text-xs text-slate-500">{selectedMoment.subMoments.length}</span></div>{selectedMoment.subMoments.map((sub) => <div key={sub.id} className="flex items-center justify-between gap-2 border-b border-white/[.06] py-2"><div className="min-w-0"><Badge>{sub.subMomentType.name}</Badge><span className="ml-2 text-xs text-slate-500">{sub.timeSeconds === null ? "—" : formatPreciseTime(sub.timeSeconds)}</span></div><div className="flex shrink-0 gap-1"><Button size="icon" variant="secondary" aria-label="Edit submoment" onClick={() => editSubmoment(sub)}><Pencil size={14} /></Button><Button size="icon" variant="danger" aria-label="Delete submoment" onClick={() => void deleteSubmoment(sub.id)}><Trash2 size={14} /></Button></div></div>)}</div></>}</Panel>
    </div>
    {editingSubmoment && selectedMoment ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><Panel className="w-full max-w-md p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Edit submoment</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setEditingSubmoment(null)}><X size={16} /></Button></div><div className="mt-4 grid gap-4"><label className="grid gap-2"><FieldLabel>Type</FieldLabel><Select value={editTypeId} onChange={(event) => setEditTypeId(event.target.value)}>{availableSubmoments.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><div className="flex justify-between"><FieldLabel>Time in seconds</FieldLabel><span className="font-mono text-xs text-slate-400">{editTime === "" ? "—" : formatPreciseTime(Number(editTime))}</span></div><TextInput type="number" step="0.1" min={selectedMoment.startTimeSeconds} max={selectedMoment.endTimeSeconds} value={editTime} onChange={(event) => setEditTime(event.target.value)} /></label><Button variant="secondary" onClick={() => setEditTime(String(Math.round(currentTime * 10) / 10))}>Use current video time</Button></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingSubmoment(null)}>Cancel</Button><Button variant="primary" disabled={saving} onClick={() => void saveEditedSubmoment()}>{saving ? "Saving…" : "Save changes"}</Button></div></Panel></div> : null}
  </div>;
}
