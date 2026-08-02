"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckSquare, FileVideo, ListVideo, Loader2, Pause, Play, Square, X } from "lucide-react";
import { Badge, Button, FieldLabel, Panel, Select } from "@/components/ui";
import type { MatchDetail, MatchSummary, MomentRecord, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getSubMomentTypesForMoment } from "@/lib/taxonomy";
import { formatPreciseTime } from "@/lib/time";
import { downloadBlob, exportMomentClip, exportQualityOptions, type ExportQuality } from "@/lib/video-export";

type ReportClip = { match: MatchDetail; moment: MomentRecord };
type PlayingClip = { index: number; url: string; autoplay: boolean };
type PendingOperation = "play" | "export";

export function ReportsClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playingUrlRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const sessionFilesRef = useRef(new Map<string, File>());
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [details, setDetails] = useState<MatchDetail[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [momentTypeId, setMomentTypeId] = useState("");
  const [subMomentTypeId, setSubMomentTypeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [playing, setPlaying] = useState<PlayingClip | null>(null);
  const [continuous, setContinuous] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportQuality, setExportQuality] = useState<ExportQuality>("high");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [missingVideos, setMissingVideos] = useState<MatchDetail[]>([]);
  const [checkingVideos, setCheckingVideos] = useState(false);
  const [videoPreparationError, setVideoPreparationError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<MatchSummary[]>("/api/matches"), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchRows, settingsData]) => { setMatches(matchRows); setSettings(settingsData); })
      .catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (selectedIds.length === 0) { setDetails([]); return; }
    setLoadingDetails(true);
    Promise.all(selectedIds.map((id) => apiFetch<MatchDetail>(`/api/matches/${id}`)))
      .then((rows) => { if (!cancelled) setDetails(rows); })
      .catch((error: Error) => { if (!cancelled) setNotice(error.message); })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedIds]);

  useEffect(() => () => { if (playingUrlRef.current) URL.revokeObjectURL(playingUrlRef.current); }, []);

  const teamNames = useMemo(() => [...new Set(matches.flatMap((match) => [match.teamName, match.opponentName]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [matches]);
  const visibleMatches = useMemo(() => matches.filter((match) => !teamFilter || match.teamName === teamFilter || match.opponentName === teamFilter), [matches, teamFilter]);
  const selectedMomentType = settings?.momentTypes.find((type) => type.id === momentTypeId) || null;
  const availableSubmomentTypes = useMemo(() => getSubMomentTypesForMoment(settings?.subMomentTypes || [], selectedMomentType), [selectedMomentType, settings?.subMomentTypes]);
  const clips = useMemo<ReportClip[]>(() => details.flatMap((match) => match.moments
    .filter((moment) => !momentTypeId || moment.momentTypeId === momentTypeId)
    .filter((moment) => !subMomentTypeId || moment.subMoments.some((sub) => sub.subMomentTypeId === subMomentTypeId))
    .map((moment) => ({ match, moment }))), [details, momentTypeId, subMomentTypeId]);

  function toggleMatch(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function changeMomentFilter(id: string) { setMomentTypeId(id); setSubMomentTypeId(""); stopPlayback(); }

  function stopPlayback() {
    videoRef.current?.pause(); setContinuous(false); setIsPlaying(false); advancingRef.current = false;
  }

  async function openClip(index: number, autoplay = true) {
    const clip = clips[index]; if (!clip) return;
    advancingRef.current = true;
    const file = await getReportVideo(clip.match.id);
    if (!file) { setNotice(`The video for “${clip.match.title}” is not available in this browser. Select the local video first.`); setContinuous(false); advancingRef.current = false; return; }
    if (playingUrlRef.current) URL.revokeObjectURL(playingUrlRef.current);
    const url = URL.createObjectURL(file); playingUrlRef.current = url; setPlaying({ index, url, autoplay }); setNotice(null);
  }

  function handleLoadedMetadata() {
    if (!playing) return; const video = videoRef.current; if (!video) return;
    video.currentTime = clips[playing.index]?.moment.startTimeSeconds || 0; advancingRef.current = false;
    if (playing.autoplay) void video.play();
  }

  function handleTimeUpdate() {
    if (!playing || advancingRef.current) return;
    const video = videoRef.current; const clip = clips[playing.index]; if (!video || !clip || video.currentTime < clip.moment.endTimeSeconds - 0.04) return;
    if (continuous && playing.index < clips.length - 1) void openClip(playing.index + 1, true);
    else { video.pause(); video.currentTime = clip.moment.endTimeSeconds; setContinuous(false); }
  }

  function startPlayback() { if (clips.length === 0) return; setContinuous(true); void openClip(0, true); }

  async function getReportVideo(matchId: string) { return sessionFilesRef.current.get(matchId) || await getRememberedMatchVideo(matchId).catch(() => null); }

  async function requestOperation(operation: PendingOperation) {
    if (clips.length === 0) return;
    setCheckingVideos(true); setVideoPreparationError(null);
    const requiredMatches = [...new Map(clips.map((clip) => [clip.match.id, clip.match])).values()];
    const availability = await Promise.all(requiredMatches.map(async (match) => ({ match, file: await getReportVideo(match.id) })));
    const missing = availability.filter((item) => !item.file).map((item) => item.match);
    setCheckingVideos(false);
    if (missing.length > 0) { setPendingOperation(operation); setMissingVideos(missing); return; }
    if (operation === "play") startPlayback(); else void exportReport();
  }

  function fileMatchesGame(file: File, match: MatchDetail) {
    if (!match.video) return true;
    return file.name.toLocaleLowerCase() === match.video.fileName.toLocaleLowerCase() && file.size === match.video.fileSize;
  }

  async function addVideo(match: MatchDetail, file?: File) {
    if (!file) return;
    if (!fileMatchesGame(file, match)) { setVideoPreparationError(`“${file.name}” does not match the expected video for “${match.title}” (${match.video?.fileName || "unknown file"}).`); return; }
    sessionFilesRef.current.set(match.id, file);
    await rememberMatchVideo(match.id, file).catch(() => undefined);
    const remaining = missingVideos.filter((item) => item.id !== match.id);
    setMissingVideos(remaining); setVideoPreparationError(null);
    if (remaining.length === 0) completePendingOperation();
  }

  async function addSeveralVideos(files: FileList | null) {
    if (!files) return;
    const candidates = [...files]; const usedIndexes = new Set<number>(); const completedIds = new Set<string>();
    try {
      for (const match of missingVideos) {
        const candidateIndex = candidates.findIndex((candidate, index) => !usedIndexes.has(index) && fileMatchesGame(candidate, match));
        if (candidateIndex >= 0) { const file = candidates[candidateIndex]; sessionFilesRef.current.set(match.id, file); await rememberMatchVideo(match.id, file).catch(() => undefined); usedIndexes.add(candidateIndex); completedIds.add(match.id); }
      }
      const remaining = missingVideos.filter((match) => !completedIds.has(match.id));
      setMissingVideos(remaining);
      if (remaining.length === 0) completePendingOperation();
      else setVideoPreparationError(`${remaining.length} video${remaining.length === 1 ? " is" : "s are"} still missing. You can add them individually.`);
    } catch { setVideoPreparationError("Could not save all videos. Check the available browser storage."); }
  }

  function completePendingOperation() {
    const operation = pendingOperation; setPendingOperation(null); setMissingVideos([]);
    if (operation === "play") startPlayback(); else if (operation === "export") void exportReport();
  }

  async function exportReport() {
    if (clips.length === 0) return;
    setExporting(true); stopPlayback(); setNotice(null);
    const zip = new JSZip(); const missing = new Set<string>();
    try {
      const byMatch = new Map<string, ReportClip[]>();
      for (const clip of clips) byMatch.set(clip.match.id, [...(byMatch.get(clip.match.id) || []), clip]);
      let completed = 0;
      for (const [matchId, matchClips] of byMatch) {
        const file = await getReportVideo(matchId);
        if (!file) { missing.add(matchClips[0].match.title); continue; }
        const url = URL.createObjectURL(file);
        try {
          for (let index = 0; index < matchClips.length; index += 1) {
            const clip = matchClips[index]; completed += 1; setExportStatus(`Exporting ${completed} of ${clips.length}: ${clip.match.title}`);
            const exported = await exportMomentClip({ sourceUrl: url, match: clip.match, moment: clip.moment, quality: exportQuality });
            const subfolders = subMomentTypeId
              ? [settings?.subMomentTypes.find((type) => type.id === subMomentTypeId)?.name || "Submoment"]
              : [...new Set(clip.moment.subMoments.map((sub) => sub.subMomentType.name))];
            if (subfolders.length === 0) subfolders.push("No submoment");
            for (const subfolder of subfolders) {
              const path = `${safeName(clip.match.title)}/${safeName(clip.moment.momentType.code)}/${safeName(subfolder)}/${String(index + 1).padStart(3, "0")}-${exported.fileName}`;
              zip.file(path, exported.blob);
            }
          }
        } finally { URL.revokeObjectURL(url); }
      }
      if (completed === 0) throw new Error("None of the selected videos are available in this browser.");
      setExportStatus("Preparing the ZIP…");
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      downloadBlob(blob, `Report-${selectedIds.length}-matches-${completed}-clips.zip`);
      setNotice(missing.size ? `Export complete. Missing videos: ${[...missing].join(", ")}.` : `${completed} clips exported successfully.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not export the report."); }
    finally { setExporting(false); setExportStatus(""); }
  }

  if (loading) return <div className="h-[70vh] animate-pulse rounded-lg bg-white/[.04]" />;
  return <div className="space-y-5">
    <header><p className="text-xs uppercase tracking-[.24em] text-cyan-200/80">Aggregated analysis</p><h1 className="mt-2 text-3xl font-semibold text-white">Match reports</h1><p className="mt-2 text-sm text-slate-400">Select matches, find clips, then play or export the results.</p></header>
    {notice && <div className="flex items-start justify-between gap-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="space-y-3 border-b border-white/10 p-4"><FieldLabel>Filter matches by team</FieldLabel><Select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">All teams</option>{teamNames.map((team) => <option key={team}>{team}</option>)}</Select><div className="flex gap-2"><Button size="sm" onClick={() => setSelectedIds([...new Set([...selectedIds, ...visibleMatches.map((match) => match.id)])])}><CheckSquare size={14} />Select visible</Button><Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button></div></div><div className="max-h-[42rem] overflow-y-auto">{visibleMatches.map((match) => { const checked = selectedIds.includes(match.id); return <button key={match.id} onClick={() => toggleMatch(match.id)} className={`flex w-full items-start gap-3 border-b border-white/[.06] p-3 text-left hover:bg-white/[.06] ${checked ? "bg-cyan-300/10" : ""}`}>{checked ? <CheckSquare className="mt-0.5 shrink-0 text-cyan-200" size={17} /> : <Square className="mt-0.5 shrink-0 text-slate-600" size={17} />}<span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{match.title}</span><span className="mt-1 block text-xs text-slate-500">{match.teamName} vs {match.opponentName} · {match.momentCount} moments</span></span></button>; })}</div></Panel>
      <div className="space-y-4">
        <Panel className="grid gap-4 p-4 md:grid-cols-3"><label className="grid gap-2"><FieldLabel>Moment</FieldLabel><Select value={momentTypeId} onChange={(event) => changeMomentFilter(event.target.value)}><option value="">All moments</option>{settings?.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><FieldLabel>Submoment</FieldLabel><Select value={subMomentTypeId} disabled={!momentTypeId} onChange={(event) => { setSubMomentTypeId(event.target.value); stopPlayback(); }}><option value="">All submoments</option>{availableSubmomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><FieldLabel>Export quality</FieldLabel><Select value={exportQuality} onChange={(event) => setExportQuality(event.target.value as ExportQuality)}>{exportQualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><span className="text-xs text-slate-500">{exportQualityOptions.find((option) => option.value === exportQuality)?.detail}</span></label></Panel>
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-white">{loadingDetails ? "Loading clips…" : `${clips.length} clips found`}</p><p className="text-xs text-slate-500">{selectedIds.length} matches selected</p></div><div className="flex flex-wrap gap-2"><Button variant="primary" disabled={clips.length === 0 || loadingDetails || checkingVideos} onClick={() => void requestOperation("play")}>{checkingVideos ? <Loader2 className="animate-spin" size={16} /> : <ListVideo size={16} />}Play all</Button><Button disabled={clips.length === 0 || exporting || checkingVideos} onClick={() => void requestOperation("export")}>{exporting || checkingVideos ? <Loader2 className="animate-spin" size={16} /> : <Archive size={16} />}{exporting ? exportStatus || "Exporting…" : "Export ZIP"}</Button></div></Panel>
        {playing && clips[playing.index] ? <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <Panel className="self-start overflow-hidden"><div className="aspect-video bg-black"><video key={playing.url} ref={videoRef} src={playing.url} className="h-full w-full" playsInline onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div><div className="flex items-center justify-between gap-3 border-t border-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm text-white">{clips[playing.index].match.title}</p><p className="text-xs text-slate-500">Clip {playing.index + 1} of {clips.length} · {clips[playing.index].moment.momentType.name}</p></div><Button size="icon" variant="primary" onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}>{isPlaying ? <Pause /> : <Play />}</Button></div></Panel>
          <div className="relative min-h-48 lg:min-h-0"><Panel className="divide-y divide-white/[.06] overflow-y-auto lg:absolute lg:inset-0"><div className="sticky top-0 z-10 border-b border-white/10 bg-pitch-950 px-3 py-2 text-xs uppercase tracking-[.18em] text-slate-500">Clips ({clips.length})</div>{clips.map((clip, index) => <button key={`${clip.match.id}-${clip.moment.id}`} onClick={() => { setContinuous(false); void openClip(index, true); }} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-white/[.06] ${playing?.index === index ? "bg-cyan-300/10" : ""}`}><Play size={15} className="shrink-0 text-cyan-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{clip.match.title}</span><span className="block truncate text-xs text-slate-500">{clip.moment.momentType.name} · {formatPreciseTime(clip.moment.startTimeSeconds)} – {formatPreciseTime(clip.moment.endTimeSeconds)}</span></span><Badge className="shrink-0">{clip.moment.subMoments.length}</Badge></button>)}</Panel></div>
        </div> : <Panel className="divide-y divide-white/[.06] overflow-hidden">{clips.length === 0 ? <div className="flex flex-col items-center p-10 text-center"><FileVideo className="text-slate-600" size={42} /><p className="mt-3 text-sm text-slate-400">Select at least one match to display clips.</p></div> : clips.map((clip, index) => <button key={`${clip.match.id}-${clip.moment.id}`} onClick={() => { setContinuous(false); void openClip(index, true); }} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/[.06]"><Play size={15} className="shrink-0 text-cyan-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{clip.match.title}</span><span className="text-xs text-slate-500">{clip.moment.momentType.name} · {formatPreciseTime(clip.moment.startTimeSeconds)} – {formatPreciseTime(clip.moment.endTimeSeconds)}</span></span><Badge>{clip.moment.subMoments.length} sub.</Badge></button>)}</Panel>}
      </div>
    </div>
    {pendingOperation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Panel className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-cyan-300/30 bg-pitch-950 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-200/80">Prepare {pendingOperation === "play" ? "playback" : "export"}</p><h2 className="mt-2 text-xl font-semibold text-white">Add missing videos</h2><p className="mt-2 text-sm text-slate-400">The action starts automatically as soon as all videos are available.</p></div><Button size="icon" variant="ghost" aria-label="Close" onClick={() => { setPendingOperation(null); setMissingVideos([]); }}><X size={17} /></Button></div><div className="p-5"><label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-cyan-300/35 bg-cyan-300/[.06] p-4 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10"><CheckSquare size={17} />Select multiple videos<input type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addSeveralVideos(event.target.files)} /></label>{videoPreparationError && <div className="mb-4 rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">{videoPreparationError}</div>}<div className="space-y-2">{missingVideos.map((match) => <div key={match.id} className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[.035] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{match.title}</p><p className="mt-1 truncate text-xs text-slate-500">Expected: {match.video?.fileName || "video for this match"}</p></div><label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[.06] px-3 text-sm text-slate-100 hover:bg-white/[.1]"><FileVideo size={15} />Select video<input type="file" accept="video/*" className="hidden" onChange={(event) => void addVideo(match, event.target.files?.[0])} /></label></div>)}</div></div></Panel></div>}
  </div>;
}

function safeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Unnamed"; }
