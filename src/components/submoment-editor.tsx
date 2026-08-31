"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Cloud, FileVideo, ListVideo, Loader2, Pause, Pencil, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { CloudVideoLibrary } from "@/components/cloud-video-library";
import { MomentEditDialog } from "@/components/moment-edit-dialog";
import { OutcomeButtons } from "@/components/outcome-buttons";
import { Badge, Button, FieldLabel, Panel, Select, TextInput } from "@/components/ui";
import { canonicalOutcome, displayMomentType, displayOutcome, perspectiveMomentTypeChoices, perspectiveQuery, type AnalysisPerspective } from "@/lib/analysis-perspective";
import type { MatchDetail, MomentRecord, SettingsPayload, SubMomentRecord, SubMomentTypeRecord, UpdateMomentInput } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { attachCloudVideo, getCloudVideoLibrary, getRemoteVideoUrl, uploadMatchVideo, type CloudVideoAsset } from "@/lib/remote-video-store";
import { getSubMomentTypesForMoment } from "@/lib/taxonomy";
import { formatBytes, formatPreciseTime, formatTime } from "@/lib/time";

export function SubmomentEditor({ matchId, perspective }: { matchId: string; perspective: AnalysisPerspective }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [filterId, setFilterId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pendingType, setPendingType] = useState<SubMomentTypeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringVideo, setRestoringVideo] = useState(true);
  const [editingSubmoment, setEditingSubmoment] = useState<SubMomentRecord | null>(null);
  const [editingMoment, setEditingMoment] = useState<MomentRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState("");
  const [editTime, setEditTime] = useState("");
  const [managingType, setManagingType] = useState<SubMomentTypeRecord | "new" | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cloudLibraryOpen, setCloudLibraryOpen] = useState(false);
  const [cloudAssets, setCloudAssets] = useState<CloudVideoAsset[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [attachingAssetId, setAttachingAssetId] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch(`/api/matches/${matchId}/analyses`, {
      method: "POST",
      body: JSON.stringify({ perspective }),
    }).catch((saveError: Error) => setError(saveError.message));
  }, [matchId, perspective]);
  const matchLoaded = match !== null;
  const videoStorageStatus = match?.video?.storageStatus;
  const videoUpdatedAt = match?.video?.updatedAt;

  useEffect(() => {
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchData, settingsData]) => { const firstTypeId = perspectiveMomentTypeChoices(settingsData.momentTypes, perspective)[0]?.id || ""; setMatch(matchData); setSettings(settingsData); setFilterId(firstTypeId); setSelectedId(matchData.moments.find((moment) => moment.momentTypeId === firstTypeId)?.id || null); })
      .catch((err: Error) => setError(err.message));
  }, [matchId, perspective]);

  useEffect(() => {
    if (!matchLoaded) return;
    let active = true;
    (videoStorageStatus === "READY" ? getRemoteVideoUrl(matchId).catch(() => null) : Promise.resolve(null))
      .then(async (remote) => {
        if (!active) return;
        if (remote) { setSourceUrl(remote.url); return; }
        const file = await getRememberedMatchVideo(matchId).catch(() => null);
        if (active && file) setSourceUrl(URL.createObjectURL(file));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setRestoringVideo(false); });
    return () => { active = false; };
  }, [matchId, matchLoaded, videoStorageStatus, videoUpdatedAt]);

  useEffect(() => () => { if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const moments = useMemo(() => (match?.moments || []).filter((moment) => moment.momentTypeId === filterId), [filterId, match?.moments]);
  const canonicalMomentTypes = useMemo(() => settings?.momentTypes || [], [settings?.momentTypes]);
  const momentTypeChoices = useMemo(() => perspectiveMomentTypeChoices(canonicalMomentTypes, perspective), [canonicalMomentTypes, perspective]);
  const selectedIndex = moments.findIndex((moment) => moment.id === selectedId);
  const selectedMoment = selectedIndex >= 0 ? moments[selectedIndex] : moments[0] || null;
  const availableSubmoments = useMemo(() => getSubMomentTypesForMoment(
    settings?.subMomentTypes || [],
    selectedMoment ? displayMomentType(selectedMoment.momentType, canonicalMomentTypes, perspective) : null,
  ), [canonicalMomentTypes, perspective, selectedMoment, settings?.subMomentTypes]);

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

  function changePlaybackRate(rate: number) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
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

  async function updateMoment(momentId: string, input: UpdateMomentInput) {
    setError(null);
    const saved = await apiFetch<MomentRecord>(`/api/moments/${momentId}`, { method: "PATCH", body: JSON.stringify(input) });
    setMatch((current) => current ? {
      ...current,
      moments: current.moments.map((moment) => moment.id === saved.id ? saved : moment),
    } : current);
    if (saved.momentTypeId !== filterId) {
      const next = match?.moments.find((moment) => moment.id !== saved.id && moment.momentTypeId === filterId);
      setSelectedId(next?.id || null);
    } else {
      setSelectedId(saved.id);
    }
    setEditingMoment(null);
  }

  async function toggleMomentOutcome(moment: MomentRecord, outcome: "positive" | "negative") {
    try {
      const visibleOutcome = displayOutcome(moment.outcome, perspective);
      await updateMoment(moment.id, { outcome: visibleOutcome === outcome ? null : canonicalOutcome(outcome, perspective) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not classify the moment.");
    }
  }

  async function deleteMoment(moment: MomentRecord) {
    if (!confirm(`Delete this moment and its ${moment.subMoments.length} submoment${moment.subMoments.length === 1 ? "" : "s"}?`)) return;
    setError(null);
    try {
      await apiFetch<void>(`/api/moments/${moment.id}`, { method: "DELETE" });
      const next = moments.find((item) => item.id !== moment.id) || null;
      setMatch((current) => current ? {
        ...current,
        momentCount: Math.max(0, current.momentCount - 1),
        moments: current.moments.filter((item) => item.id !== moment.id),
      } : current);
      setSelectedId(next?.id || null);
      setEditingMoment(null);
      setContinuous(false);
      videoRef.current?.pause();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the moment.");
    }
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

  async function toggleSubmomentOutcome(submoment: SubMomentRecord, outcome: "positive" | "negative") {
    if (!selectedMoment) return;
    setError(null);
    try {
      const visibleOutcome = displayOutcome(submoment.outcome, perspective);
      const saved = await apiFetch<SubMomentRecord>(`/api/submoments/${submoment.id}`, { method: "PATCH", body: JSON.stringify({ outcome: visibleOutcome === outcome ? null : canonicalOutcome(outcome, perspective) }) });
      setMatch((current) => current ? { ...current, moments: current.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: moment.subMoments.map((sub) => sub.id === saved.id ? saved : sub) } : moment) } : current);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not classify the submoment."); }
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

  async function loadVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    await rememberMatchVideo(matchId, file).catch(() => setError("The video opened, but it may need to be selected again for local clip export."));
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const result = await uploadMatchVideo(matchId, file, ({ progress, detail }) => {
        setUploadProgress(progress);
        setError(`${detail} ${Math.round(progress * 100)}%`);
      }, controller.signal);
      const [remote, savedMatch] = await Promise.all([getRemoteVideoUrl(matchId), apiFetch<MatchDetail>(`/api/matches/${matchId}`)]);
      setSourceUrl(remote.url);
      setMatch(savedMatch);
      setError(result.resumed ? "Video upload resumed and completed successfully." : "Video stored securely in Cloudflare R2.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The video could not be uploaded.");
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploading(false);
    }
  }

  async function loadCloudLibrary() {
    setCloudLoading(true);
    setCloudError(null);
    try {
      setCloudAssets((await getCloudVideoLibrary()).assets);
    } catch (cloudLoadError) {
      setCloudError(cloudLoadError instanceof Error ? cloudLoadError.message : "Could not load the cloud library.");
    } finally {
      setCloudLoading(false);
    }
  }

  function openCloudLibrary() {
    setCloudLibraryOpen(true);
    void loadCloudLibrary();
  }

  async function selectCloudVideo(asset: CloudVideoAsset) {
    setAttachingAssetId(asset.id);
    setCloudError(null);
    try {
      await attachCloudVideo(matchId, asset.id);
      const [remote, savedMatch] = await Promise.all([getRemoteVideoUrl(matchId), apiFetch<MatchDetail>(`/api/matches/${matchId}`)]);
      if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(remote.url);
      setMatch(savedMatch);
      setRestoringVideo(false);
      setCloudLibraryOpen(false);
      setError(`${asset.fileName} selected from the shared cloud library.`);
    } catch (attachError) {
      setCloudError(attachError instanceof Error ? attachError.message : "Could not use this cloud video.");
    } finally {
      setAttachingAssetId(null);
    }
  }

  if (error && !match) return <Panel className="p-5 text-red-100">{error}</Panel>;
  if (!match || !settings) return <div className="h-[70vh] animate-pulse rounded-lg bg-white/[.04]" />;

  return <div className="flex min-h-0 flex-col gap-2 xl:h-[calc(100dvh-6.5rem)] xl:overflow-hidden">
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void loadVideo(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <Panel className="flex shrink-0 flex-wrap items-center gap-2 px-2 py-1.5"><Link href={`/analysis/${matchId}?${perspectiveQuery(perspective)}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[.04] px-2.5 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[.08] hover:text-white"><ArrowLeft size={12} />Video analysis</Link><Badge className="max-w-36 truncate border-cyan-300/25 bg-cyan-300/10 text-cyan-100" title={`Analysing ${perspective === "team" ? match.teamName || match.opponentName : match.opponentName}`}>Analysing: {perspective === "team" ? match.teamName || match.opponentName : match.opponentName}</Badge><label className="flex min-w-56 flex-1 items-center gap-2"><span className="shrink-0 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Moment</span><Select className="h-8 min-w-0 flex-1 py-0 text-xs" value={filterId} onChange={(event) => changeFilter(event.target.value)}>{momentTypeChoices.map((type) => <option key={type.id} value={type.id}>{type.name} ({match.moments.filter((moment) => moment.momentTypeId === type.id).length})</option>)}</Select></label><Badge>{selectedIndex >= 0 ? `${selectedIndex + 1} / ${moments.length}` : `0 / ${moments.length}`}</Badge><Button size="sm" className="h-8 whitespace-nowrap" variant="primary" onClick={startAll} disabled={!sourceUrl || moments.length === 0}><ListVideo size={13} />Play all ({moments.length})</Button><Button size="sm" className="h-8 whitespace-nowrap" variant="secondary" disabled={uploading} onClick={openCloudLibrary}><Cloud size={13} />Cloud library</Button><Button size="sm" className="h-8 whitespace-nowrap" variant={uploading ? "danger" : "secondary"} onClick={() => uploading ? uploadAbortRef.current?.abort() : inputRef.current?.click()}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}{uploading ? `Cancel ${Math.round(uploadProgress * 100)}%` : match.video?.storageStatus === "READY" ? "Replace video" : "Upload video"}</Button></Panel>
    {error && <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-amber-300/30 bg-pitch-950/95 px-3 py-2 text-xs text-amber-100 shadow-2xl"><span className="min-w-0 flex-1">{error}</span><button type="button" aria-label="Close message" onClick={() => setError(null)}><X size={13} /></button></div>}
    {managingType ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><Panel className="w-full max-w-md p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{managingType === "new" ? "Add submoment" : "Edit submoment type"}</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setManagingType(null)}><X size={16} /></Button></div><div className="mt-4 grid gap-4"><label className="grid gap-2"><FieldLabel>Name</FieldLabel><TextInput value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Submoment name" /></label><label className="grid gap-2"><FieldLabel>Code</FieldLabel><TextInput value={typeCode} onChange={(event) => setTypeCode(event.target.value.toUpperCase())} placeholder="TYPE_CODE" /></label></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setManagingType(null)}>Cancel</Button><Button variant="primary" disabled={saving || !typeName.trim() || !typeCode.trim()} onClick={() => void saveManagedType()}>{saving ? "Saving…" : "Save"}</Button></div></Panel></div> : null}
    <div className="submoment-layout grid min-h-0 flex-1 items-stretch gap-2 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      <div className="relative min-h-48 xl:min-h-0"><Panel className="overflow-y-auto xl:absolute xl:inset-0"><div className="sticky top-0 z-10 border-b border-white/10 bg-pitch-950 px-2.5 py-2 text-xs uppercase tracking-[.18em] text-slate-500">Clips ({moments.length})</div>{moments.length === 0 ? <p className="p-4 text-sm text-slate-400">There are no moments of this type.</p> : moments.map((moment, index) => <div key={moment.id} className={`border-b border-white/[.06] px-2.5 py-1.5 ${selectedMoment?.id === moment.id ? "bg-cyan-300/10" : ""}`}><button onClick={() => selectMoment(moment)} className="flex w-full items-center gap-2 text-left hover:text-cyan-100"><span className="font-mono text-[10px] text-slate-500">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs text-white">{formatPreciseTime(moment.startTimeSeconds)} – {formatPreciseTime(moment.endTimeSeconds)}</span><span className="shrink-0 text-[10px] text-cyan-100">{moment.subMoments.length} sub.</span></button><div className="mt-1 flex flex-wrap items-center justify-end gap-1"><OutcomeButtons compact value={displayOutcome(moment.outcome, perspective)} onChange={(outcome) => void toggleMomentOutcome(moment, outcome)} /><Button size="sm" variant="secondary" className="h-6 px-1.5 text-[10px]" onClick={() => setEditingMoment(moment)}><Pencil size={11} />Edit</Button><Button size="sm" variant="danger" className="h-6 px-1.5 text-[10px]" onClick={() => void deleteMoment(moment)}><Trash2 size={11} />Delete</Button></div></div>)}</Panel></div>
      <div className="space-y-3"><Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" className="h-full w-full" playsInline onLoadedMetadata={() => changePlaybackRate(playbackRate)} onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><FileVideo size={52} className="text-cyan-200" /><p className="mt-3 text-sm text-slate-400">{restoringVideo ? "Loading the cloud video…" : "Upload the video for this match."}</p>{!restoringVideo && match.video ? <div className="mt-4 w-full max-w-lg rounded-md border border-cyan-300/25 bg-cyan-300/[.07] p-3 text-left"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-cyan-200/70">Expected video</p><p className="mt-1 truncate text-sm font-medium text-cyan-50">{match.video.fileName}</p><p className="mt-1 text-xs text-slate-400">{formatBytes(match.video.fileSize)} · {formatTime(match.video.durationSeconds)}</p></div> : null}{!restoringVideo ? <div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => inputRef.current?.click()}><Upload size={16} />Upload new</Button><Button variant="secondary" onClick={openCloudLibrary}><Cloud size={16} />Cloud library</Button></div> : null}</div>}{uploading ? <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3"><div className="flex items-center gap-2"><Button size="icon" disabled={selectedIndex <= 0} onClick={() => selectMoment(moments[selectedIndex - 1])}><ChevronLeft /></Button><Button size="icon" variant="primary" disabled={!sourceUrl || !selectedMoment} onClick={togglePlayback}>{isPlaying ? <Pause /> : <Play />}</Button><Button size="icon" disabled={selectedIndex < 0 || selectedIndex >= moments.length - 1} onClick={() => selectMoment(moments[selectedIndex + 1])}><ChevronRight /></Button><div className="flex overflow-hidden rounded-md border border-white/10">{[1, 2, 4].map((rate) => <button key={rate} type="button" className={`h-9 px-2 text-xs transition ${playbackRate === rate ? "bg-cyan-300 text-slate-950" : "bg-white/[.04] text-slate-300 hover:bg-white/[.1]"}`} onClick={() => changePlaybackRate(rate)}>{rate}×</button>)}</div></div><span className="font-mono text-sm text-slate-300">{formatPreciseTime(currentTime)} {continuous ? "· continuous playback" : ""}</span></div></Panel></div>
      <div className="relative min-h-48 xl:min-h-0"><Panel className="overflow-y-auto p-3 xl:absolute xl:inset-0">{!selectedMoment ? <p className="text-sm text-slate-400">Select a clip.</p> : <><div className="grid grid-cols-2 gap-2">{availableSubmoments.map((type) => <Button key={type.id} size="sm" variant={pendingType?.id === type.id ? "primary" : "secondary"} onClick={() => chooseType(type)}>{type.name}</Button>)}</div>{pendingType && <div className="mt-3 border-t border-white/10 pt-3"><p className="mb-2 text-xs text-slate-400">The submoment will be saved at {formatPreciseTime(currentTime)}.</p><Button className="w-full" variant="primary" disabled={saving} onClick={() => void saveSubmoment()}><Check size={16} />{saving ? "Saving…" : `Save ${pendingType.name}`}</Button></div>}<div className="mt-3 border-t border-white/10 pt-3"><div className="mb-1 flex justify-between"><FieldLabel>Saved</FieldLabel><span className="text-xs text-slate-500">{selectedMoment.subMoments.length}</span></div>{selectedMoment.subMoments.map((sub) => <div key={sub.id} className="border-b border-white/[.06] py-1.5"><div className="flex min-w-0 items-center"><Badge className="px-1.5 py-0.5 text-[11px]">{sub.subMomentType.name}</Badge><span className="ml-2 text-[10px] text-slate-500">{sub.timeSeconds === null ? "—" : formatPreciseTime(sub.timeSeconds)}</span></div><div className="mt-1 flex flex-wrap items-center justify-end gap-1"><OutcomeButtons compact value={displayOutcome(sub.outcome, perspective)} onChange={(outcome) => void toggleSubmomentOutcome(sub, outcome)} /><Button size="sm" variant="secondary" className="h-6 px-1.5 text-[10px]" onClick={() => editSubmoment(sub)}><Pencil size={11} />Edit</Button><Button size="sm" variant="danger" className="h-6 px-1.5 text-[10px]" onClick={() => void deleteSubmoment(sub.id)}><Trash2 size={11} />Delete</Button></div></div>)}</div></>}</Panel></div>
    </div>
    <Panel className="shrink-0 p-2">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-300">Manage submoment buttons</p><Button size="sm" variant="primary" onClick={openNewType}><Plus size={14} />Add submoment</Button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{availableSubmoments.map((type) => <div key={type.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1"><Button size="sm" variant={pendingType?.id === type.id ? "primary" : "secondary"} onClick={() => chooseType(type)}>{type.name}</Button><Button size="icon" variant="secondary" aria-label={`Edit ${type.name}`} onClick={() => openEditType(type)}><Pencil size={13} /></Button><Button size="icon" variant="danger" aria-label={`Delete ${type.name}`} onClick={() => void deleteType(type)}><Trash2 size={13} /></Button></div>)}</div>
    </Panel>
    {editingMoment ? <MomentEditDialog moment={editingMoment} momentTypes={momentTypeChoices} currentTime={currentTime} duration={videoRef.current?.duration || match.video?.durationSeconds || 0} onPreview={(start) => { if (videoRef.current) { videoRef.current.currentTime = start; void videoRef.current.play(); } }} onSave={updateMoment} onClose={() => setEditingMoment(null)} /> : null}
    {editingSubmoment && selectedMoment ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><Panel className="w-full max-w-md p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Edit submoment</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setEditingSubmoment(null)}><X size={16} /></Button></div><div className="mt-4 grid gap-4"><label className="grid gap-2"><FieldLabel>Type</FieldLabel><Select value={editTypeId} onChange={(event) => setEditTypeId(event.target.value)}>{(editingSubmoment && !availableSubmoments.some((type) => type.id === editingSubmoment.subMomentTypeId) ? [editingSubmoment.subMomentType, ...availableSubmoments] : availableSubmoments).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><div className="flex justify-between"><FieldLabel>Time in seconds</FieldLabel><span className="font-mono text-xs text-slate-400">{editTime === "" ? "—" : formatPreciseTime(Number(editTime))}</span></div><TextInput type="number" step="0.1" min={selectedMoment.startTimeSeconds} max={selectedMoment.endTimeSeconds} value={editTime} onChange={(event) => setEditTime(event.target.value)} /></label><Button variant="secondary" onClick={() => setEditTime(String(Math.round(currentTime * 10) / 10))}>Use current video time</Button></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingSubmoment(null)}>Cancel</Button><Button variant="primary" disabled={saving} onClick={() => void saveEditedSubmoment()}>{saving ? "Saving…" : "Save changes"}</Button></div></Panel></div> : null}
    {cloudLibraryOpen ? <CloudVideoLibrary assets={cloudAssets} loading={cloudLoading} error={cloudError} attachingAssetId={attachingAssetId} onRetry={() => void loadCloudLibrary()} onClose={() => { if (!attachingAssetId) setCloudLibraryOpen(false); }} onSelect={(asset) => void selectCloudVideo(asset)} /> : null}
  </div>;
}
