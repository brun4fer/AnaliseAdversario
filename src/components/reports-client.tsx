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
import { downloadBlob, exportMomentClip } from "@/lib/video-export";

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
    if (!file) { setNotice(`O vídeo de “${clip.match.title}” não está disponível neste browser. Abra primeiro esse jogo e selecione o vídeo local.`); setContinuous(false); advancingRef.current = false; return; }
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
    if (!fileMatchesGame(file, match)) { setVideoPreparationError(`“${file.name}” não corresponde ao vídeo esperado para “${match.title}” (${match.video?.fileName || "ficheiro desconhecido"}).`); return; }
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
      else setVideoPreparationError(`${remaining.length} vídeo${remaining.length === 1 ? " continua" : "s continuam"} em falta. Pode adicioná-los individualmente.`);
    } catch { setVideoPreparationError("Não foi possível guardar todos os vídeos. Verifique o espaço disponível no browser."); }
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
            const clip = matchClips[index]; completed += 1; setExportStatus(`A exportar ${completed} de ${clips.length}: ${clip.match.title}`);
            const exported = await exportMomentClip({ sourceUrl: url, match: clip.match, moment: clip.moment });
            const subfolders = subMomentTypeId
              ? [settings?.subMomentTypes.find((type) => type.id === subMomentTypeId)?.name || "Submomento"]
              : [...new Set(clip.moment.subMoments.map((sub) => sub.subMomentType.name))];
            if (subfolders.length === 0) subfolders.push("Sem submomento");
            for (const subfolder of subfolders) {
              const path = `${safeName(clip.match.title)}/${safeName(clip.moment.momentType.code)}/${safeName(subfolder)}/${String(index + 1).padStart(3, "0")}-${exported.fileName}`;
              zip.file(path, exported.blob);
            }
          }
        } finally { URL.revokeObjectURL(url); }
      }
      if (completed === 0) throw new Error("Nenhum dos vídeos selecionados está disponível neste browser.");
      setExportStatus("A preparar o ZIP…");
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      downloadBlob(blob, `Relatorio-${selectedIds.length}-jogos-${completed}-clips.zip`);
      setNotice(missing.size ? `Exportação concluída. Faltaram os vídeos: ${[...missing].join(", ")}.` : `${completed} clips exportados com sucesso.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível exportar o relatório."); }
    finally { setExporting(false); setExportStatus(""); }
  }

  if (loading) return <div className="h-[70vh] animate-pulse rounded-lg bg-white/[.04]" />;
  return <div className="space-y-5">
    <header><p className="text-xs uppercase tracking-[.24em] text-cyan-200/80">Análise agregada</p><h1 className="mt-2 text-3xl font-semibold text-white">Relatórios por jogo</h1><p className="mt-2 text-sm text-slate-400">Selecione jogos, encontre clips e reproduza ou exporte os resultados.</p></header>
    {notice && <div className="flex items-start justify-between gap-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="space-y-3 border-b border-white/10 p-4"><FieldLabel>Filtrar jogos por equipa</FieldLabel><Select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Todas as equipas</option>{teamNames.map((team) => <option key={team}>{team}</option>)}</Select><div className="flex gap-2"><Button size="sm" onClick={() => setSelectedIds([...new Set([...selectedIds, ...visibleMatches.map((match) => match.id)])])}><CheckSquare size={14} />Selecionar visíveis</Button><Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpar</Button></div></div><div className="max-h-[42rem] overflow-y-auto">{visibleMatches.map((match) => { const checked = selectedIds.includes(match.id); return <button key={match.id} onClick={() => toggleMatch(match.id)} className={`flex w-full items-start gap-3 border-b border-white/[.06] p-3 text-left hover:bg-white/[.06] ${checked ? "bg-cyan-300/10" : ""}`}>{checked ? <CheckSquare className="mt-0.5 shrink-0 text-cyan-200" size={17} /> : <Square className="mt-0.5 shrink-0 text-slate-600" size={17} />}<span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{match.title}</span><span className="mt-1 block text-xs text-slate-500">{match.teamName} vs {match.opponentName} · {match.momentCount} momentos</span></span></button>; })}</div></Panel>
      <div className="space-y-4">
        <Panel className="grid gap-4 p-4 md:grid-cols-2"><label className="grid gap-2"><FieldLabel>Momento</FieldLabel><Select value={momentTypeId} onChange={(event) => changeMomentFilter(event.target.value)}><option value="">Todos os momentos</option>{settings?.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><FieldLabel>Submomento</FieldLabel><Select value={subMomentTypeId} disabled={!momentTypeId} onChange={(event) => { setSubMomentTypeId(event.target.value); stopPlayback(); }}><option value="">Todos os submomentos</option>{availableSubmomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label></Panel>
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-white">{loadingDetails ? "A carregar clips…" : `${clips.length} clips encontrados`}</p><p className="text-xs text-slate-500">{selectedIds.length} jogos selecionados</p></div><div className="flex flex-wrap gap-2"><Button variant="primary" disabled={clips.length === 0 || loadingDetails || checkingVideos} onClick={() => void requestOperation("play")}>{checkingVideos ? <Loader2 className="animate-spin" size={16} /> : <ListVideo size={16} />}Reproduzir todos</Button><Button disabled={clips.length === 0 || exporting || checkingVideos} onClick={() => void requestOperation("export")}>{exporting || checkingVideos ? <Loader2 className="animate-spin" size={16} /> : <Archive size={16} />}{exporting ? exportStatus || "A exportar…" : "Exportar ZIP"}</Button></div></Panel>
        {playing && clips[playing.index] ? <Panel className="overflow-hidden"><div className="aspect-video bg-black"><video key={playing.url} ref={videoRef} src={playing.url} className="h-full w-full" playsInline onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div><div className="flex items-center justify-between gap-3 border-t border-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm text-white">{clips[playing.index].match.title}</p><p className="text-xs text-slate-500">Clip {playing.index + 1} de {clips.length} · {clips[playing.index].moment.momentType.name}</p></div><Button size="icon" variant="primary" onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}>{isPlaying ? <Pause /> : <Play />}</Button></div></Panel> : null}
        <Panel className="divide-y divide-white/[.06] overflow-hidden">{clips.length === 0 ? <div className="flex flex-col items-center p-10 text-center"><FileVideo className="text-slate-600" size={42} /><p className="mt-3 text-sm text-slate-400">Selecione pelo menos um jogo para mostrar os clips.</p></div> : clips.map((clip, index) => <button key={`${clip.match.id}-${clip.moment.id}`} onClick={() => { setContinuous(false); void openClip(index, true); }} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-white/[.06] ${playing?.index === index ? "bg-cyan-300/10" : ""}`}><Play size={15} className="shrink-0 text-cyan-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{clip.match.title}</span><span className="text-xs text-slate-500">{clip.moment.momentType.name} · {formatPreciseTime(clip.moment.startTimeSeconds)} – {formatPreciseTime(clip.moment.endTimeSeconds)}</span></span><Badge>{clip.moment.subMoments.length} sub.</Badge></button>)}</Panel>
      </div>
    </div>
    {pendingOperation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Panel className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-cyan-300/30 bg-pitch-950 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-200/80">Preparar {pendingOperation === "play" ? "reprodução" : "exportação"}</p><h2 className="mt-2 text-xl font-semibold text-white">Adicionar vídeos em falta</h2><p className="mt-2 text-sm text-slate-400">Quando todos estiverem disponíveis, a ação começa automaticamente.</p></div><Button size="icon" variant="ghost" onClick={() => { setPendingOperation(null); setMissingVideos([]); }}><X size={17} /></Button></div><div className="p-5"><label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-cyan-300/35 bg-cyan-300/[.06] p-4 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10"><CheckSquare size={17} />Selecionar vários vídeos<input type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addSeveralVideos(event.target.files)} /></label>{videoPreparationError && <div className="mb-4 rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">{videoPreparationError}</div>}<div className="space-y-2">{missingVideos.map((match) => <div key={match.id} className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[.035] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{match.title}</p><p className="mt-1 truncate text-xs text-slate-500">Esperado: {match.video?.fileName || "vídeo deste jogo"}</p></div><label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[.06] px-3 text-sm text-slate-100 hover:bg-white/[.1]"><FileVideo size={15} />Selecionar vídeo<input type="file" accept="video/*" className="hidden" onChange={(event) => void addVideo(match, event.target.files?.[0])} /></label></div>)}</div></div></Panel></div>}
  </div>;
}

function safeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Sem nome"; }
