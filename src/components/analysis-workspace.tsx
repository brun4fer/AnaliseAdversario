"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileVideo,
  Filter,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Settings,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { MomentDetailPanel } from "@/components/moment-detail-panel";
import { Badge, Button, FieldLabel, Panel, Select, TextInput } from "@/components/ui";
import { useKeyboardShortcuts, type ShortcutBinding } from "@/hooks/use-keyboard-shortcuts";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { cn } from "@/lib/cn";
import type {
  CreateSubMomentInput,
  MatchDetail,
  MomentRecord,
  MomentTypeRecord,
  SettingsPayload,
  SubMomentRecord,
  UpdateMomentInput,
  VideoMetadataInput,
  VideoRecord,
} from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { formatBytes, formatPreciseTime, formatTime, roundSeconds } from "@/lib/time";

type ActiveMoment = {
  id: string;
  momentTypeId: string;
  startTimeSeconds: number;
};

type VideoWarning = {
  expected: VideoRecord;
  selected: VideoMetadataInput;
};

function createTemporaryId() {
  return globalThis.crypto?.randomUUID?.() ?? `active-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const player = useVideoPlayer();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [activeMoments, setActiveMoments] = useState<ActiveMoment[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [videoWarning, setVideoWarning] = useState<VideoWarning | null>(null);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [specificTime, setSpecificTime] = useState("");
  const [saveSignal, setSaveSignal] = useState(0);

  useEffect(() => {
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchPayload, settingsPayload]) => {
        setMatch(matchPayload);
        setSettings(settingsPayload);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const momentTypes = useMemo(() => settings?.momentTypes ?? [], [settings?.momentTypes]);
  const subMomentTypes = useMemo(() => settings?.subMomentTypes ?? [], [settings?.subMomentTypes]);

  const selectedMoment = useMemo(
    () => match?.moments.find((moment) => moment.id === selectedMomentId) ?? null,
    [match?.moments, selectedMomentId],
  );

  const filteredMoments = useMemo(() => {
    const moments = match?.moments ?? [];
    if (filter === "all") {
      return moments;
    }
    return moments.filter((moment) => moment.momentTypeId === filter);
  }, [filter, match?.moments]);

  const latestMoments = useMemo(() => [...(match?.moments ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), [match?.moments]);

  const getShortcutForMomentType = useCallback(
    (momentTypeId: string) =>
      settings?.shortcuts.find(
        (shortcut) => shortcut.actionType === "moment.toggle" && shortcut.targetType === "momentType" && shortcut.targetId === momentTypeId,
      )?.key ?? "—",
    [settings?.shortcuts],
  );

  const upsertMomentInState = useCallback((moment: MomentRecord) => {
    setMatch((current) => {
      if (!current) {
        return current;
      }

      const exists = current.moments.some((item) => item.id === moment.id);
      const moments = exists
        ? current.moments.map((item) => (item.id === moment.id ? moment : item))
        : [...current.moments, moment];

      return {
        ...current,
        momentCount: moments.length,
        moments: moments.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
      };
    });
  }, []);

  const createMoment = useCallback(
    async (momentType: MomentTypeRecord, start: number, end: number) => {
      if (!match) {
        return null;
      }

      const saved = await apiFetch<MomentRecord>(`/api/matches/${match.id}/moments`, {
        method: "POST",
        body: JSON.stringify({
          videoId: match.video?.id ?? null,
          momentTypeId: momentType.id,
          startTimeSeconds: start,
          endTimeSeconds: Math.max(end, start + 0.1),
        }),
      });
      upsertMomentInState(saved);
      setSelectedMomentId(saved.id);
      setNotice(`${momentType.code} guardado: ${formatPreciseTime(saved.startTimeSeconds)} - ${formatPreciseTime(saved.endTimeSeconds)}`);
      return saved;
    },
    [match, upsertMomentInState],
  );

  const toggleMoment = useCallback(
    (momentType: MomentTypeRecord) => {
      if (!player.sourceUrl) {
        setNotice("Selecione primeiro o vídeo local do jogo.");
        fileInputRef.current?.click();
        return;
      }

      const currentVideoTime = roundSeconds(player.videoRef.current?.currentTime ?? player.currentTime);
      const active = activeMoments.find((moment) => moment.momentTypeId === momentType.id);

      if (!active) {
        setActiveMoments((current) => [
          ...current,
          {
            id: createTemporaryId(),
            momentTypeId: momentType.id,
            startTimeSeconds: currentVideoTime,
          },
        ]);
        setNotice(`${momentType.code} iniciado aos ${formatPreciseTime(currentVideoTime)}.`);
        return;
      }

      setActiveMoments((current) => current.filter((moment) => moment.id !== active.id));
      void createMoment(momentType, active.startTimeSeconds, currentVideoTime);
    },
    [activeMoments, createMoment, player.currentTime, player.sourceUrl, player.videoRef],
  );

  const cancelLastActiveMoment = useCallback(() => {
    setActiveMoments((current) => {
      if (current.length === 0) {
        return current;
      }
      const next = current.slice(0, -1);
      setNotice("Marcação ativa cancelada.");
      return next;
    });
  }, []);

  const shortcutBindings = useMemo<ShortcutBinding[]>(() => {
    if (!settings) {
      return [];
    }

    return settings.shortcuts
      .map((shortcut) => {
        if (shortcut.actionType === "moment.toggle" && shortcut.targetId) {
          const momentType = momentTypes.find((type) => type.id === shortcut.targetId);
          if (!momentType) {
            return null;
          }
          return { key: shortcut.key, handler: () => toggleMoment(momentType) };
        }

        const handlers: Partial<Record<string, () => void>> = {
          "player.togglePlay": player.togglePlay,
          "player.seekBack5": () => player.seekBy(-5),
          "player.seekForward5": () => player.seekBy(5),
          "player.seekBack15": () => player.seekBy(-15),
          "player.seekForward15": () => player.seekBy(15),
          "moment.cancelActive": cancelLastActiveMoment,
          "editor.save": () => setSaveSignal((current) => current + 1),
        };

        const handler = handlers[shortcut.actionType];
        return handler ? { key: shortcut.key, handler } : null;
      })
      .filter(Boolean) as ShortcutBinding[];
  }, [cancelLastActiveMoment, momentTypes, player, settings, toggleMoment]);

  useKeyboardShortcuts(shortcutBindings, Boolean(settings));

  function handleFileSelected(file: File | null) {
    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith("video/")) {
      player.setError("O ficheiro selecionado não parece ser vídeo. Use MP4/H.264 para melhor compatibilidade.");
      return;
    }

    pendingFileRef.current = file;
    player.loadFile(file);
    setNotice("A ler metadata do vídeo local.");
  }

  async function handleLoadedMetadata() {
    const duration = player.handleLoadedMetadata();
    const file = pendingFileRef.current;

    if (!file || !match) {
      return;
    }

    const metadata: VideoMetadataInput = {
      fileName: file.name,
      fileSize: file.size,
      durationSeconds: roundSeconds(duration),
      mimeType: file.type || "video/*",
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    };

    if (match.video) {
      const sameVideo =
        match.video.fileName === metadata.fileName &&
        match.video.fileSize === metadata.fileSize &&
        Math.abs(match.video.durationSeconds - metadata.durationSeconds) < 1.5;

      if (!sameVideo) {
        setVideoWarning({ expected: match.video, selected: metadata });
        return;
      }

      setNotice("Vídeo validado com a metadata guardada.");
      if (match.moments.length > 0) {
        setResumePrompt(true);
      }
      return;
    }

    await saveVideoMetadata(metadata);
  }

  async function saveVideoMetadata(metadata: VideoMetadataInput) {
    const saved = await apiFetch<VideoRecord>(`/api/matches/${matchId}/video`, {
      method: "PUT",
      body: JSON.stringify(metadata),
    });

    setMatch((current) => (current ? { ...current, video: saved } : current));
    setVideoWarning(null);
    setNotice("Metadata do vídeo guardada. O ficheiro continua apenas no browser.");
    if ((match?.moments.length ?? 0) > 0) {
      setResumePrompt(true);
    }
  }

  async function handleManualMoment() {
    const momentType = filter !== "all" ? momentTypes.find((type) => type.id === filter) : momentTypes[0];
    if (!momentType) {
      return;
    }

    const start = roundSeconds(player.videoRef.current?.currentTime ?? player.currentTime);
    await createMoment(momentType, start, start + 10);
  }

  async function handleUpdateMoment(momentId: string, input: UpdateMomentInput) {
    const saved = await apiFetch<MomentRecord>(`/api/moments/${momentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    upsertMomentInState(saved);
    setNotice("Momento guardado.");
  }

  async function handleDeleteMoment(momentId: string) {
    if (!window.confirm("Apagar este momento e todos os submomentos associados?")) {
      return;
    }

    await apiFetch<void>(`/api/moments/${momentId}`, { method: "DELETE" });
    setMatch((current) => {
      if (!current) {
        return current;
      }
      const moments = current.moments.filter((moment) => moment.id !== momentId);
      return { ...current, moments, momentCount: moments.length };
    });
    setSelectedMomentId(null);
    setNotice("Momento apagado.");
  }

  async function handleAddSubMoment(input: CreateSubMomentInput) {
    const saved = await apiFetch<SubMomentRecord>(`/api/moments/${input.momentId}/submoments`, {
      method: "POST",
      body: JSON.stringify(input),
    });

    setMatch((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        moments: current.moments.map((moment) =>
          moment.id === input.momentId ? { ...moment, subMoments: [...moment.subMoments, saved] } : moment,
        ),
      };
    });
    setNotice("Submomento guardado.");
  }

  async function handleDeleteSubMoment(subMomentId: string) {
    await apiFetch<void>(`/api/submoments/${subMomentId}`, { method: "DELETE" });
    setMatch((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        moments: current.moments.map((moment) => ({
          ...moment,
          subMoments: moment.subMoments.filter((subMoment) => subMoment.id !== subMomentId),
        })),
      };
    });
    setNotice("Submomento apagado.");
  }

  function reviewMoment(moment: MomentRecord) {
    setSelectedMomentId(moment.id);
    player.reviewSegment(moment.startTimeSeconds, moment.endTimeSeconds);
  }

  if (loading) {
    return <div className="h-[70vh] animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />;
  }

  if (error || !match || !settings) {
    return (
      <Panel className="border-red-400/30 p-5 text-red-100">
        {error ?? "Não foi possível abrir esta análise."}
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
      />

      <header className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-panel xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Análise de vídeo</Badge>
            <span className="text-xs text-slate-500">{match.opponentName}</span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold text-white">{match.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Selecionar vídeo local
          </Button>
          <Link href={`/matches/${match.id}/edit`}>
            <Button variant="secondary">
              <Settings size={16} />
              Editar jogo
            </Button>
          </Link>
        </div>
      </header>

      <MomentToolbar
        momentTypes={momentTypes}
        activeMoments={activeMoments}
        getShortcut={getShortcutForMomentType}
        onToggle={toggleMoment}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              {player.sourceUrl ? (
                <video
                  ref={player.videoRef}
                  src={player.sourceUrl}
                  className="h-full w-full"
                  controls={false}
                  playsInline
                  onLoadedMetadata={() => void handleLoadedMetadata()}
                  onTimeUpdate={player.handleTimeUpdate}
                  onPlay={() => player.setIsPlaying(true)}
                  onPause={() => player.setIsPlaying(false)}
                  onError={() => player.setError("Não foi possível reproduzir este vídeo. Para melhor compatibilidade, use MP4 com codec H.264.")}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <FileVideo className="text-cyan-200" size={56} />
                  <h2 className="mt-4 text-xl font-semibold text-white">Selecione o vídeo local do jogo</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                    O ficheiro fica apenas no browser. A aplicação guarda só metadata, tempos, tipos, notas e coordenadas.
                  </p>
                  <Button className="mt-5" variant="primary" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} />
                    Escolher vídeo
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-pitch-950/90 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => player.seekBy(-15)} aria-label="Voltar 15 segundos">
                    <ChevronsLeft size={17} />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => player.seekBy(-5)} aria-label="Voltar 5 segundos">
                    <RotateCcw size={17} />
                  </Button>
                  <Button size="icon" variant="primary" onClick={player.togglePlay} aria-label={player.isPlaying ? "Pausar" : "Reproduzir"}>
                    {player.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => player.seekBy(5)} aria-label="Avançar 5 segundos">
                    <ChevronsRight size={17} />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => player.seekBy(15)} aria-label="Avançar 15 segundos">
                    <ChevronsRight size={17} className="scale-125" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Clock size={15} className="text-cyan-200" />
                    {formatPreciseTime(player.currentTime)} / {formatTime(player.duration)}
                  </span>
                  {match.video ? <span className="text-xs text-emerald-200">Metadata validada</span> : <span className="text-xs text-slate-500">Sem metadata guardada</span>}
                </div>
              </div>
              {player.error ? <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-100">{player.error}</p> : null}
            </div>
          </Panel>

          <Timeline moments={match.moments} duration={player.duration} onSelect={reviewMoment} />

          {selectedMoment ? (
            <MomentDetailPanel
              moment={selectedMoment}
              momentTypes={momentTypes}
              subMomentTypes={subMomentTypes}
              currentTime={player.currentTime}
              saveSignal={saveSignal}
              onSave={handleUpdateMoment}
              onDelete={handleDeleteMoment}
              onAddSubMoment={handleAddSubMoment}
              onDeleteSubMoment={handleDeleteSubMoment}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ações</p>
                <h2 className="mt-1 font-semibold text-white">Marcação rápida</h2>
              </div>
              <Button variant="primary" size="sm" onClick={() => void handleManualMoment()}>
                <Plus size={15} />
                Criar nova ação
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <FieldLabel>Momentos ativos</FieldLabel>
              {activeMoments.length === 0 ? (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                  Nenhuma marcação em curso.
                </p>
              ) : (
                activeMoments.map((active) => {
                  const type = momentTypes.find((momentType) => momentType.id === active.momentTypeId);
                  if (!type) {
                    return null;
                  }
                  return (
                    <div key={active.id} className="flex items-center justify-between gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-2">
                      <div className="min-w-0">
                        <Badge style={{ borderColor: `${type.color}66`, color: type.color }}>{type.code}</Badge>
                        <p className="mt-1 text-xs text-slate-300">Início {formatPreciseTime(active.startTimeSeconds)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="primary" aria-label={`Fechar ${type.code}`} onClick={() => toggleMoment(type)}>
                          <Square size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Cancelar ${type.code}`}
                          onClick={() => setActiveMoments((current) => current.filter((item) => item.id !== active.id))}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Painel lateral</p>
                  <h2 className="mt-1 font-semibold text-white">Momentos guardados</h2>
                </div>
                <Filter size={17} className="text-cyan-200" />
              </div>
              <div className="mt-3">
                <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {momentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.code} · {type.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="max-h-[34rem] overflow-y-auto p-3">
              {filteredMoments.length === 0 ? (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                  Sem momentos para o filtro selecionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredMoments.map((moment) => (
                    <MomentListItem
                      key={moment.id}
                      moment={moment}
                      active={selectedMomentId === moment.id}
                      onReview={reviewMoment}
                      onDelete={handleDeleteMoment}
                    />
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <FieldLabel>Últimas ações</FieldLabel>
            <div className="mt-3 space-y-2">
              {latestMoments.length === 0 ? (
                <p className="text-sm text-slate-500">Ainda não há ações fechadas.</p>
              ) : (
                latestMoments.map((moment) => (
                  <button
                    key={moment.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.035] p-2 text-left text-sm hover:bg-white/[0.07]"
                    onClick={() => reviewMoment(moment)}
                  >
                    <span className="min-w-0 truncate text-slate-200">{moment.momentType.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatPreciseTime(moment.startTimeSeconds)}</span>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {notice ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-pitch-900 px-4 py-2 text-sm text-cyan-100 shadow-glow">
          {notice}
        </div>
      ) : null}

      {videoWarning ? (
        <VideoMismatchDialog
          warning={videoWarning}
          onChooseOther={() => {
            setVideoWarning(null);
            player.unload();
            pendingFileRef.current = null;
            fileInputRef.current?.click();
          }}
          onContinue={() => void saveVideoMetadata(videoWarning.selected)}
        />
      ) : null}

      {resumePrompt ? (
        <ResumeDialog
          lastMoment={match.moments[match.moments.length - 1] ?? null}
          specificTime={specificTime}
          onSpecificTimeChange={setSpecificTime}
          onClose={() => setResumePrompt(false)}
          onStart={() => {
            player.seekTo(0);
            setResumePrompt(false);
          }}
          onLast={(time) => {
            player.seekTo(time);
            setResumePrompt(false);
          }}
          onSpecific={() => {
            player.seekTo(Number(specificTime) || 0);
            setResumePrompt(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MomentToolbar({
  momentTypes,
  activeMoments,
  getShortcut,
  onToggle,
}: {
  momentTypes: MomentTypeRecord[];
  activeMoments: ActiveMoment[];
  getShortcut: (momentTypeId: string) => string;
  onToggle: (momentType: MomentTypeRecord) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
      {momentTypes.map((type) => {
        const active = activeMoments.some((moment) => moment.momentTypeId === type.id);
        return (
          <button
            key={type.id}
            type="button"
            className={cn(
              "group flex min-h-16 items-center justify-between gap-3 rounded-lg border bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
              active ? "border-cyan-200/70 shadow-glow" : "border-white/10",
            )}
            style={active ? { backgroundColor: `${type.color}1f` } : undefined}
            onClick={() => onToggle(type)}
          >
            <span className="min-w-0">
              <span className="block text-lg font-semibold" style={{ color: type.color }}>
                {type.code}
              </span>
              <span className="block truncate text-xs text-slate-400">{type.name}</span>
            </span>
            <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs text-slate-300">{getShortcut(type.id)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Timeline({
  moments,
  duration,
  onSelect,
}: {
  moments: MomentRecord[];
  duration: number;
  onSelect: (moment: MomentRecord) => void;
}) {
  const timelineDuration = Math.max(duration, ...moments.map((moment) => moment.endTimeSeconds), 1);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Timeline</p>
          <h2 className="mt-1 font-semibold text-white">Momentos no vídeo</h2>
        </div>
        <Scissors size={17} className="text-cyan-200" />
      </div>
      <div className="relative h-20 overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {moments.map((moment, index) => {
          const left = (moment.startTimeSeconds / timelineDuration) * 100;
          const width = Math.max(0.8, ((moment.endTimeSeconds - moment.startTimeSeconds) / timelineDuration) * 100);
          const top = 10 + (index % 3) * 20;
          return (
            <button
              key={moment.id}
              type="button"
              className="absolute h-4 rounded-full border border-white/20 text-[0px] shadow-sm transition hover:scale-y-125"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top,
                backgroundColor: moment.momentType.color,
              }}
              onClick={() => onSelect(moment)}
              title={`${moment.momentType.code} ${formatPreciseTime(moment.startTimeSeconds)}`}
            >
              {moment.momentType.code}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function MomentListItem({
  moment,
  active,
  onReview,
  onDelete,
}: {
  moment: MomentRecord;
  active: boolean;
  onReview: (moment: MomentRecord) => void;
  onDelete: (momentId: string) => Promise<void>;
}) {
  return (
    <div className={cn("rounded-md border p-3 transition", active ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/[0.035]")}>
      <button type="button" className="w-full text-left" onClick={() => onReview(moment)}>
        <div className="flex items-center justify-between gap-2">
          <Badge style={{ borderColor: `${moment.momentType.color}66`, color: moment.momentType.color }}>{moment.momentType.code}</Badge>
          <span className="text-xs text-slate-500">{formatPreciseTime(moment.durationSeconds)}</span>
        </div>
        <p className="mt-2 truncate text-sm font-medium text-white">{moment.momentType.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatPreciseTime(moment.startTimeSeconds)} - {formatPreciseTime(moment.endTimeSeconds)}
        </p>
        {moment.subMoments.length > 0 ? <p className="mt-2 text-xs text-cyan-100">{moment.subMoments.length} submomentos</p> : null}
      </button>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => onReview(moment)}>
          <Play size={14} />
          Rever
        </Button>
        <Button size="sm" variant="danger" onClick={() => void onDelete(moment.id)} aria-label="Apagar momento">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

function VideoMismatchDialog({
  warning,
  onChooseOther,
  onContinue,
}: {
  warning: VideoWarning;
  onChooseOther: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Panel className="max-w-3xl border-amber-300/30 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="shrink-0 text-amber-200" size={28} />
          <div>
            <h2 className="text-lg font-semibold text-white">Este vídeo parece ser diferente do vídeo usado anteriormente nesta análise.</h2>
            <p className="mt-2 text-sm text-slate-400">Confirme a metadata antes de continuar. O vídeo não será enviado.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <VideoMetadataCard title="Esperado" metadata={warning.expected} />
          <VideoMetadataCard title="Selecionado" metadata={warning.selected} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onChooseOther}>
            Escolher outro vídeo
          </Button>
          <Button variant="primary" onClick={onContinue}>
            Continuar mesmo assim
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function VideoMetadataCard({ title, metadata }: { title: string; metadata: VideoRecord | VideoMetadataInput }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Nome" value={metadata.fileName} />
        <Row label="Duração" value={formatPreciseTime(metadata.durationSeconds)} />
        <Row label="Tamanho" value={formatBytes(metadata.fileSize)} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-slate-200">{value}</dd>
    </div>
  );
}

function ResumeDialog({
  lastMoment,
  specificTime,
  onSpecificTimeChange,
  onClose,
  onStart,
  onLast,
  onSpecific,
}: {
  lastMoment: MomentRecord | null;
  specificTime: string;
  onSpecificTimeChange: (value: string) => void;
  onClose: () => void;
  onStart: () => void;
  onLast: (time: number) => void;
  onSpecific: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Panel className="w-full max-w-xl p-5">
        <h2 className="text-lg font-semibold text-white">Retomar análise</h2>
        <p className="mt-2 text-sm text-slate-400">Este jogo já tem momentos guardados. Escolha onde quer posicionar o vídeo.</p>
        <div className="mt-5 grid gap-3">
          <Button variant="secondary" onClick={onStart}>
            Ir para início
          </Button>
          <Button variant="secondary" disabled={!lastMoment} onClick={() => onLast(lastMoment?.endTimeSeconds ?? 0)}>
            Ir para última marcação {lastMoment ? `(${formatPreciseTime(lastMoment.endTimeSeconds)})` : ""}
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextInput
              type="number"
              step="0.1"
              min="0"
              placeholder="Tempo em segundos"
              value={specificTime}
              onChange={(event) => onSpecificTimeChange(event.target.value)}
            />
            <Button variant="primary" onClick={onSpecific}>
              Ir para tempo
            </Button>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Panel>
    </div>
  );
}
