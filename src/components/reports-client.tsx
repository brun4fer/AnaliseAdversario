"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckSquare, FileVideo, ListVideo, Loader2, Pause, Play, Square, X } from "lucide-react";
import { Badge, Button, FieldLabel, Panel, Select } from "@/components/ui";
import type { MatchDetail, MatchSummary, MomentRecord, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo } from "@/lib/local-video-store";
import { getSubMomentTypesForMoment } from "@/lib/taxonomy";
import { formatPreciseTime } from "@/lib/time";
import { downloadBlob, exportMomentClip } from "@/lib/video-export";

type ReportClip = { match: MatchDetail; moment: MomentRecord };
type PlayingClip = { index: number; url: string; autoplay: boolean };

export function ReportsClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playingUrlRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
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
    const file = await getRememberedMatchVideo(clip.match.id).catch(() => null);
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

  function playAll() { if (clips.length === 0) return; setContinuous(true); void openClip(0, true); }

  async function exportReport() {
    if (clips.length === 0) return;
    setExporting(true); stopPlayback(); setNotice(null);
    const zip = new JSZip(); const missing = new Set<string>();
    try {
      const byMatch = new Map<string, ReportClip[]>();
      for (const clip of clips) byMatch.set(clip.match.id, [...(byMatch.get(clip.match.id) || []), clip]);
      let completed = 0;
      for (const [matchId, matchClips] of byMatch) {
        const file = await getRememberedMatchVideo(matchId).catch(() => null);
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
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-white">{loadingDetails ? "A carregar clips…" : `${clips.length} clips encontrados`}</p><p className="text-xs text-slate-500">{selectedIds.length} jogos selecionados</p></div><div className="flex flex-wrap gap-2"><Button variant="primary" disabled={clips.length === 0 || loadingDetails} onClick={playAll}><ListVideo size={16} />Reproduzir todos</Button><Button disabled={clips.length === 0 || exporting} onClick={() => void exportReport()}>{exporting ? <Loader2 className="animate-spin" size={16} /> : <Archive size={16} />}{exporting ? exportStatus || "A exportar…" : "Exportar ZIP"}</Button></div></Panel>
        {playing && clips[playing.index] ? <Panel className="overflow-hidden"><div className="aspect-video bg-black"><video key={playing.url} ref={videoRef} src={playing.url} className="h-full w-full" playsInline onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div><div className="flex items-center justify-between gap-3 border-t border-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm text-white">{clips[playing.index].match.title}</p><p className="text-xs text-slate-500">Clip {playing.index + 1} de {clips.length} · {clips[playing.index].moment.momentType.name}</p></div><Button size="icon" variant="primary" onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}>{isPlaying ? <Pause /> : <Play />}</Button></div></Panel> : null}
        <Panel className="divide-y divide-white/[.06] overflow-hidden">{clips.length === 0 ? <div className="flex flex-col items-center p-10 text-center"><FileVideo className="text-slate-600" size={42} /><p className="mt-3 text-sm text-slate-400">Selecione pelo menos um jogo para mostrar os clips.</p></div> : clips.map((clip, index) => <button key={`${clip.match.id}-${clip.moment.id}`} onClick={() => { setContinuous(false); void openClip(index, true); }} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-white/[.06] ${playing?.index === index ? "bg-cyan-300/10" : ""}`}><Play size={15} className="shrink-0 text-cyan-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{clip.match.title}</span><span className="text-xs text-slate-500">{clip.moment.momentType.name} · {formatPreciseTime(clip.moment.startTimeSeconds)} – {formatPreciseTime(clip.moment.endTimeSeconds)}</span></span><Badge>{clip.moment.subMoments.length} sub.</Badge></button>)}</Panel>
      </div>
    </div>
  </div>;
}

function safeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Sem nome"; }
