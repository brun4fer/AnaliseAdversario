"use client";

import Link from "next/link";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Crosshair,
  Download,
  FileVideo,
  Goal,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Scissors,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { GoalTarget, TacticalField, type SurfaceMarker } from "@/components/tactical-surfaces";
import { MomentEditDialog } from "@/components/moment-edit-dialog";
import { OutcomeButtons } from "@/components/outcome-buttons";
import { SubmomentEditDialog } from "@/components/submoment-edit-dialog";
import { Badge, Button, FieldLabel, Panel, Select, TextInput } from "@/components/ui";
import { useKeyboardShortcuts, type ShortcutBinding } from "@/hooks/use-keyboard-shortcuts";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { cn } from "@/lib/cn";
import type {
  CreateSubMomentInput,
  MatchDetail,
  MatchRecord,
  MomentRecord,
  MomentTypeRecord,
  SettingsPayload,
  SubMomentRecord,
  SubMomentTypeRecord,
  UpdateSubMomentInput,
  UpdateMomentInput,
} from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { isExportPickerCancellation, pickExportDirectory, writeBlobToDirectory } from "@/lib/export-directory";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getRemoteVideoUrl, uploadMatchVideo } from "@/lib/remote-video-store";
import { SmartVideoExportSession } from "@/lib/smart-video-export";
import { getSubMomentShortcut, getSubMomentTypesForMoment, requiresGoalLocationForSubMoment } from "@/lib/taxonomy";
import { formatBytes, formatPreciseTime, formatTime, roundSeconds } from "@/lib/time";
import { downloadBlob, exportQualityOptions, type ExportQuality } from "@/lib/video-export";

type ActiveMoment = {
  id: string;
  momentTypeId: string;
  startTimeSeconds: number;
};

type Point = {
  x: number;
  y: number;
};

type PendingSubMoment = {
  moment: MomentRecord;
  subMomentType: SubMomentTypeRecord;
  timeSeconds: number;
};

type PeriodMarkerKey = "firstHalfStartSeconds" | "firstHalfEndSeconds" | "secondHalfStartSeconds" | "secondHalfEndSeconds";

function exportModeLabel(mode: "direct" | "webcodecs" | "compatibility") {
  if (mode === "direct") return "direct cut, no quality loss";
  if (mode === "webcodecs") return "exact WebCodecs cut";
  return "compatibility mode";
}

function createTemporaryId() {
  return globalThis.crypto?.randomUUID?.() ?? `active-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const player = useVideoPlayer();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeMoments, setActiveMoments] = useState<ActiveMoment[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [selectedSubMomentId, setSelectedSubMomentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [specificTime, setSpecificTime] = useState("");
  const [seekTime, setSeekTime] = useState("");
  const [pendingSubMoment, setPendingSubMoment] = useState<PendingSubMoment | null>(null);
  const [pendingFieldPoint, setPendingFieldPoint] = useState<Point | null>(null);
  const [pendingGoalPoint, setPendingGoalPoint] = useState<Point | null>(null);
  const [savingPendingSubMoment, setSavingPendingSubMoment] = useState(false);
  const [exporting, setExporting] = useState<"clip" | "group" | "all" | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<ExportQuality>("high");
  const [videoFinished, setVideoFinished] = useState(false);
  const [editingMoment, setEditingMoment] = useState<MomentRecord | null>(null);
  const [editingSubMoment, setEditingSubMoment] = useState<SubMomentRecord | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(async ([matchPayload, settingsPayload]) => {
        if (!active) return;
        setMatch(matchPayload);
        setSettings(settingsPayload);
        if (matchPayload.video?.storageStatus === "READY") {
          const remote = await getRemoteVideoUrl(matchId).catch(() => null);
          if (active && remote) {
            player.loadUrl(remote.url);
            return;
          }
        }
        const local = await getRememberedMatchVideo(matchId).catch(() => null);
        if (active && local) player.loadFile(local);
      })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps


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

  const selectedSubMomentTypes = useMemo(
    () => getSubMomentTypesForMoment(subMomentTypes, selectedMoment?.momentType ?? null),
    [selectedMoment?.momentType, subMomentTypes],
  );

  const pendingMoment = useMemo(() => {
    if (!pendingSubMoment) {
      return null;
    }

    return match?.moments.find((moment) => moment.id === pendingSubMoment.moment.id) ?? pendingSubMoment.moment;
  }, [match?.moments, pendingSubMoment]);

  const pendingFieldMarkers = useMemo(
    () =>
      (pendingMoment?.subMoments ?? [])
        .filter((subMoment) => subMoment.fieldX !== null && subMoment.fieldY !== null)
        .map((subMoment) => ({
          id: `field-${subMoment.id}`,
          x: subMoment.fieldX as number,
          y: subMoment.fieldY as number,
          label: subMoment.subMomentType.name,
          detail: subMoment.timeSeconds !== null ? formatPreciseTime(subMoment.timeSeconds) : "No time",
        })),
    [pendingMoment?.subMoments],
  );

  const pendingGoalMarkers = useMemo(
    () =>
      (pendingMoment?.subMoments ?? [])
        .filter((subMoment) => subMoment.goalX !== null && subMoment.goalY !== null)
        .map((subMoment) => ({
          id: `goal-${subMoment.id}`,
          x: subMoment.goalX as number,
          y: subMoment.goalY as number,
          label: subMoment.subMomentType.name,
          detail: subMoment.timeSeconds !== null ? formatPreciseTime(subMoment.timeSeconds) : "No time",
        })),
    [pendingMoment?.subMoments],
  );

  const selectedFieldMarkers = useMemo(
    () =>
      (selectedMoment?.subMoments ?? [])
        .filter((subMoment) => subMoment.fieldX !== null && subMoment.fieldY !== null)
        .map((subMoment) => ({
          id: `selected-field-${subMoment.id}`,
          x: subMoment.fieldX as number,
          y: subMoment.fieldY as number,
          label: subMoment.subMomentType.name,
          detail: subMoment.timeSeconds !== null ? formatPreciseTime(subMoment.timeSeconds) : "No time",
          active: subMoment.id === selectedSubMomentId,
        })),
    [selectedMoment?.subMoments, selectedSubMomentId],
  );

  const selectedGoalMarkers = useMemo(
    () =>
      (selectedMoment?.subMoments ?? [])
        .filter((subMoment) => subMoment.goalX !== null && subMoment.goalY !== null)
        .map((subMoment) => ({
          id: `selected-goal-${subMoment.id}`,
          x: subMoment.goalX as number,
          y: subMoment.goalY as number,
          label: subMoment.subMomentType.name,
          detail: subMoment.timeSeconds !== null ? formatPreciseTime(subMoment.timeSeconds) : "No time",
          active: subMoment.id === selectedSubMomentId,
        })),
    [selectedMoment?.subMoments, selectedSubMomentId],
  );

  const getShortcutForMomentType = useCallback(
    (momentTypeId: string) =>
      settings?.shortcuts.find(
        (shortcut) => shortcut.actionType === "moment.toggle" && shortcut.targetType === "momentType" && shortcut.targetId === momentTypeId,
      )?.key ?? "-",
    [settings?.shortcuts],
  );

  const getShortcutForSubMomentType = useCallback(
    (subMomentTypeId: string) => {
      const index = selectedSubMomentTypes.findIndex((type) => type.id === subMomentTypeId);
      return getSubMomentShortcut(index) ?? "";
    },
    [selectedSubMomentTypes],
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
      setNotice(`${momentType.code} saved: ${formatPreciseTime(saved.startTimeSeconds)} - ${formatPreciseTime(saved.endTimeSeconds)}`);
      return saved;
    },
    [match, upsertMomentInState],
  );

  const updateMoment = useCallback(async (momentId: string, input: UpdateMomentInput) => {
    const saved = await apiFetch<MomentRecord>(`/api/moments/${momentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    upsertMomentInState(saved);
    setEditingMoment(null);
    setNotice("Moment updated.");
  }, [upsertMomentInState]);

  const deleteMoment = useCallback(async (moment: MomentRecord) => {
    if (!window.confirm(`Delete ${moment.momentType.name} at ${formatPreciseTime(moment.startTimeSeconds)}?`)) return;
    await apiFetch<void>(`/api/moments/${moment.id}`, { method: "DELETE" });
    setMatch((current) => current ? {
      ...current,
      momentCount: Math.max(0, current.momentCount - 1),
      moments: current.moments.filter((item) => item.id !== moment.id),
    } : current);
    setSelectedMomentId((current) => current === moment.id ? null : current);
    setEditingMoment((current) => current?.id === moment.id ? null : current);
    setNotice("Moment deleted.");
  }, []);

  const toggleOutcome = useCallback(async (moment: MomentRecord, outcome: "positive" | "negative") => {
    await updateMoment(moment.id, { outcome: moment.outcome === outcome ? null : outcome });
  }, [updateMoment]);

  const updateSubMoment = useCallback(async (subMomentId: string, input: UpdateSubMomentInput) => {
    const saved = await apiFetch<SubMomentRecord>(`/api/submoments/${subMomentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setMatch((current) => current ? {
      ...current,
      moments: current.moments.map((moment) => ({
        ...moment,
        subMoments: moment.subMoments.map((subMoment) => subMoment.id === saved.id ? saved : subMoment),
      })),
    } : current);
    setEditingSubMoment(null);
    setNotice("Submoment updated.");
  }, []);

  const toggleSubMomentOutcome = useCallback(async (subMoment: SubMomentRecord, outcome: "positive" | "negative") => {
    await updateSubMoment(subMoment.id, { outcome: subMoment.outcome === outcome ? null : outcome });
  }, [updateSubMoment]);

  const deleteSubMoment = useCallback(async (subMoment: SubMomentRecord) => {
    if (!window.confirm(`Delete submoment ${subMoment.subMomentType.name}?`)) return;
    await apiFetch<void>(`/api/submoments/${subMoment.id}`, { method: "DELETE" });
    setMatch((current) => current ? {
      ...current,
      moments: current.moments.map((moment) => ({
        ...moment,
        subMoments: moment.subMoments.filter((item) => item.id !== subMoment.id),
      })),
    } : current);
    setSelectedSubMomentId((current) => current === subMoment.id ? null : current);
    setEditingSubMoment((current) => current?.id === subMoment.id ? null : current);
    setNotice("Submoment deleted.");
  }, []);

  const toggleMoment = useCallback(
    (momentType: MomentTypeRecord) => {
      if (!player.sourceUrl) {
        setNotice("Select the local match video first.");
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
      setNotice("Active tag cancelled.");
      return next;
    });
  }, []);

  const handleAddSubMoment = useCallback(async (input: CreateSubMomentInput) => {
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
          moment.id === input.momentId
            ? {
                ...moment,
                subMoments: [...moment.subMoments, saved].sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0)),
              }
            : moment,
        ),
      };
    });
    setSelectedSubMomentId(saved.id);
    setNotice("Submoment saved.");
  }, []);

  const handleQuickAddSubMoment = useCallback(
    async (subMomentType: SubMomentTypeRecord) => {
      if (!selectedMoment) {
        setNotice("Select a moment to log submoments.");
        return;
      }

      if (!player.sourceUrl) {
        setNotice("Select the local match video first.");
        fileInputRef.current?.click();
        return;
      }

      const currentVideoTime = roundSeconds(player.videoRef.current?.currentTime ?? player.currentTime);
      const insideSelectedMoment =
        currentVideoTime >= selectedMoment.startTimeSeconds - 0.25 &&
        currentVideoTime <= selectedMoment.endTimeSeconds + 0.25;

      if (!insideSelectedMoment) {
        player.reviewSegment(selectedMoment.startTimeSeconds, selectedMoment.endTimeSeconds);
        setNotice("Clip opened. Mark the submoment at the right time.");
        return;
      }

      player.pause();
      setPendingFieldPoint(null);
      setPendingGoalPoint(null);
      setPendingSubMoment({
        moment: selectedMoment,
        subMomentType,
        timeSeconds: currentVideoTime,
      });
      setNotice(`${subMomentType.name}: mark the zone on the field.`);
    },
    [player, selectedMoment],
  );

  const cancelPendingSubMoment = useCallback(() => {
    setPendingSubMoment(null);
    setPendingFieldPoint(null);
    setPendingGoalPoint(null);
    setSavingPendingSubMoment(false);
  }, []);

  const confirmPendingSubMoment = useCallback(async () => {
    if (!pendingSubMoment) {
      return;
    }

    const requiresGoalLocation = requiresGoalLocationForSubMoment(pendingSubMoment.subMomentType);

    if (!pendingFieldPoint) {
      setNotice("Mark the field zone first.");
      return;
    }

    if (requiresGoalLocation && !pendingGoalPoint) {
      setNotice("Also mark the zone on the goal.");
      return;
    }

    setSavingPendingSubMoment(true);
    try {
      await handleAddSubMoment({
        momentId: pendingSubMoment.moment.id,
        subMomentTypeId: pendingSubMoment.subMomentType.id,
        timeSeconds: pendingSubMoment.timeSeconds,
        fieldX: pendingFieldPoint?.x ?? null,
        fieldY: pendingFieldPoint?.y ?? null,
        goalX: requiresGoalLocation ? pendingGoalPoint?.x ?? null : null,
        goalY: requiresGoalLocation ? pendingGoalPoint?.y ?? null : null,
        notes: null,
      });
      setNotice(`${pendingSubMoment.subMomentType.name} logged at ${formatPreciseTime(pendingSubMoment.timeSeconds)}.`);
      cancelPendingSubMoment();
    } finally {
      setSavingPendingSubMoment(false);
    }
  }, [cancelPendingSubMoment, handleAddSubMoment, pendingFieldPoint, pendingGoalPoint, pendingSubMoment]);

  const shortcutBindings = useMemo<ShortcutBinding[]>(() => {
    if (!settings) {
      return [];
    }

    const configuredBindings = settings.shortcuts
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
        };

        const handler = handlers[shortcut.actionType];
        return handler ? { key: shortcut.key, handler } : null;
      })
      .filter(Boolean) as ShortcutBinding[];

    return configuredBindings;
  }, [cancelLastActiveMoment, momentTypes, player, settings, toggleMoment]);

  useKeyboardShortcuts(shortcutBindings, Boolean(settings) && !pendingSubMoment);

  async function handleFileSelected(file: File | null) {
    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith("video/")) {
      player.setError("The selected file does not appear to be a video. Use MP4/H.264 for better compatibility.");
      return;
    }

    player.loadFile(file);
    await rememberMatchVideo(matchId, file).catch(() => setNotice("The video opened, but it may need to be selected again for local clip export."));
    setUploading(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const result = await uploadMatchVideo(matchId, file, ({ progress, detail }) => {
        setUploadProgress(progress);
        setNotice(`${detail} ${Math.round(progress * 100)}%`);
      }, controller.signal);
      const savedMatch = await apiFetch<MatchDetail>(`/api/matches/${matchId}`);
      setMatch(savedMatch);
      setNotice(result.resumed ? "Video upload resumed and completed successfully." : "Video stored securely in Cloudflare R2.");
      if (savedMatch.moments.length > 0) setResumePrompt(true);
    } catch (uploadError) {
      setNotice(uploadError instanceof Error ? uploadError.message : "The video could not be uploaded.");
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploading(false);
    }
  }

  function handleLoadedMetadata() { player.handleLoadedMetadata(); }

  function reviewMoment(moment: MomentRecord) {
    setSelectedMomentId(moment.id);
    setSelectedSubMomentId(null);
    player.reviewSegment(moment.startTimeSeconds, moment.endTimeSeconds);
  }

  function goToExactTime() {
    const seconds = Number(seekTime);
    if (!Number.isFinite(seconds) || seconds < 0) {
      setNotice("Enter a valid time in seconds.");
      return;
    }
    player.seekTo(seconds);
    setSeekTime(String(roundSeconds(Math.min(seconds, player.duration || seconds))));
  }

  async function setPeriodMarker(key: PeriodMarkerKey) {
    if (!match || !player.sourceUrl) {
      setNotice("Select the local match video first.");
      return;
    }
    const seconds = roundSeconds(player.videoRef.current?.currentTime ?? player.currentTime);
    const saved = await apiFetch<MatchRecord>(`/api/matches/${match.id}`, { method: "PATCH", body: JSON.stringify({ [key]: seconds }) });
    setMatch((current) => current ? { ...current, ...saved } : current);
    setNotice(`Match period time saved at ${formatPreciseTime(seconds)}.`);
  }

  function reviewSubMoment(subMoment: SubMomentRecord) {
    setSelectedSubMomentId(subMoment.id);
    if (subMoment.timeSeconds !== null) {
      player.seekTo(subMoment.timeSeconds);
    }
  }

  async function getExportVideo() {
    if (player.file && player.sourceUrl) {
      return { source: player.file as File | string, url: player.sourceUrl };
    }
    if (!match || match.video?.storageStatus !== "READY") return null;
    const remote = await getRemoteVideoUrl(match.id).catch(() => null);
    return remote ? { source: remote.url as File | string, url: remote.url } : null;
  }

  async function exportSelectedMoment() {
    if (!selectedMoment || !match) {
      return;
    }
    const exportVideo = await getExportVideo();
    if (!exportVideo) {
      setNotice("The cloud video is not available. Select the local video to continue.");
      fileInputRef.current?.click();
      return;
    }

    setExporting("clip");
    player.pause();
    const session = new SmartVideoExportSession(exportVideo.source);
    try {
      const exported = await session.exportMoment({
        sourceUrlFallback: exportVideo.url,
        match,
        moment: selectedMoment,
        quality: exportQuality,
        onStatus: setExportStatus,
      });
      downloadBlob(exported.blob, exported.fileName);
      setNotice(`MP4 video exported (${exportModeLabel(exported.mode)}): ${exported.fileName}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not export the video.");
    } finally {
      session.dispose();
      setExporting(null);
      setExportStatus(null);
    }
  }

  async function exportMomentType() {
    if (!selectedMoment || !match) {
      return;
    }
    const exportVideo = await getExportVideo();
    if (!exportVideo) {
      setNotice("The cloud video is not available. Select the local video to continue.");
      fileInputRef.current?.click();
      return;
    }

    const moments = match.moments.filter((moment) => moment.momentTypeId === selectedMoment.momentTypeId);
    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (error) {
      if (isExportPickerCancellation(error)) return;
      setNotice(error instanceof Error ? error.message : "Could not open the destination folder.");
      return;
    }
    setExporting("group");
    player.pause();
    const session = new SmartVideoExportSession(exportVideo.source);
    try {
      const zip = directory ? null : new JSZip();
      const safeType = selectedMoment.momentType.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "moment";
      for (let index = 0; index < moments.length; index += 1) {
        const moment = moments[index];
        setExportStatus(`Exporting ${index + 1} of ${moments.length}: ${moment.momentType.name}`);
        const exported = await session.exportMoment({
          sourceUrlFallback: exportVideo.url,
          match,
          moment,
          quality: exportQuality,
          onStatus: (status) => setExportStatus(`${index + 1} of ${moments.length}: ${status}`),
        });
        const indexedFileName = `${String(index + 1).padStart(3, "0")}-${exported.fileName}`;
        if (directory) await writeBlobToDirectory(directory, `${safeType}/${indexedFileName}`, exported.blob);
        else zip?.file(indexedFileName, exported.blob);
      }
      setExportStatus(directory ? "Finalizing exported files..." : "Preparing the ZIP file...");
      if (zip) {
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        downloadBlob(blob, `${safeType}-${moments.length}-videos.zip`);
      }
      setNotice(`${moments.length} MP4 videos exported${directory ? " to the selected folder" : ""}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not export the videos.");
    } finally {
      session.dispose();
      setExporting(null);
      setExportStatus(null);
    }
  }

  async function exportAllMoments() {
    if (!match || match.moments.length === 0) return;
    const exportVideo = await getExportVideo();
    if (!exportVideo) {
      setNotice("The cloud video is not available. Select the local video to continue.");
      fileInputRef.current?.click();
      return;
    }

    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (error) {
      if (isExportPickerCancellation(error)) return;
      setNotice(error instanceof Error ? error.message : "Could not open the destination folder.");
      return;
    }
    setExporting("all");
    player.pause();
    const session = new SmartVideoExportSession(exportVideo.source);
    try {
      const zip = directory ? null : new JSZip();
      const safeMatch = match.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "match";
      for (let index = 0; index < match.moments.length; index += 1) {
        const moment = match.moments[index];
        setExportStatus(`Exporting ${index + 1} of ${match.moments.length}: ${moment.momentType.name}`);
        const exported = await session.exportMoment({
          sourceUrlFallback: exportVideo.url,
          match,
          moment,
          quality: exportQuality,
          onStatus: (status) => setExportStatus(`${index + 1} of ${match.moments.length}: ${status}`),
        });
        const folder = moment.momentType.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "moments";
        const path = `${safeMatch}/${folder}/${String(index + 1).padStart(3, "0")}-${exported.fileName}`;
        if (directory) await writeBlobToDirectory(directory, path, exported.blob);
        else zip?.file(`${folder}/${String(index + 1).padStart(3, "0")}-${exported.fileName}`, exported.blob);
      }
      setExportStatus(directory ? "Finalizing exported files..." : "Preparing the ZIP file...");
      if (zip) {
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        downloadBlob(blob, `${safeMatch}-all-${match.moments.length}-moments.zip`);
      }
      setNotice(`${match.moments.length} moments exported successfully${directory ? " to the selected folder" : ""}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not export all moments.");
    } finally {
      session.dispose();
      setExporting(null);
      setExportStatus(null);
    }
  }

  if (loading) {
    return <div className="h-[70vh] animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />;
  }

  if (error || !match || !settings) {
    return (
      <Panel className="border-red-400/30 p-5 text-red-100">
        {error ?? "Could not open this analysis."}
      </Panel>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 xl:h-[calc(100dvh-6.5rem)] xl:overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => { void handleFileSelected(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}
      />

      <Panel className="flex shrink-0 items-stretch overflow-hidden">
        <div className="flex shrink-0 items-center gap-1 border-r border-white/10 px-2">
          <Link href="/" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[.06] hover:text-white"><ArrowLeft size={12} />Matches</Link>
          <Link href={`/matches/${match.id}/edit`} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-white/[.06] hover:text-white" title="Edit match" aria-label="Edit match"><Settings size={13} /></Link>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 py-1.5" aria-label="Main moments">
          {momentTypes.map((type) => { const active = activeMoments.some((moment) => moment.momentTypeId === type.id); return <button key={type.id} type="button" onClick={() => toggleMoment(type)} title={`${type.name} · ${getShortcutForMomentType(type.id)}`} className={cn("flex h-11 min-w-[6rem] shrink-0 items-center justify-between gap-2 rounded-md border px-2 text-left transition", active ? "border-cyan-200/70 bg-cyan-300/10 shadow-glow" : "border-white/10 bg-white/[.035] hover:bg-white/[.08]")}><span className="min-w-0"><span className="block truncate text-[9px] font-bold" style={{ color: type.color }}>{type.name}</span><span className={cn("mt-0.5 block text-[8px]", active ? "text-cyan-100" : "text-slate-600")}>{active ? "In progress" : "Click to start"}</span></span><kbd className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] text-slate-300">{getShortcutForMomentType(type.id)}</kbd></button>; })}
        </div>
        <div className="flex shrink-0 items-center border-l border-white/10 px-2">
          <Button size="sm" className="h-8 whitespace-nowrap" variant={uploading ? "danger" : "secondary"} onClick={() => uploading ? uploadAbortRef.current?.abort() : fileInputRef.current?.click()}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}{uploading ? `Cancel ${Math.round(uploadProgress * 100)}%` : match.video?.storageStatus === "READY" ? "Replace video" : "Upload video"}</Button>
        </div>
      </Panel>

      <div className="grid min-h-0 flex-1 items-stretch gap-2 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="relative min-h-48 xl:min-h-0">
        <Panel className="flex min-h-0 flex-col overflow-hidden xl:absolute xl:inset-0">
          <div className="border-b border-white/10 px-3 py-3">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tagged moments</p><p className="mt-1 text-xs text-slate-400">{match.moments.length} in the video</p></div><Button size="sm" variant="secondary" className="shrink-0 px-2" disabled={match.moments.length === 0 || Boolean(exporting)} onClick={() => void exportAllMoments()} title="Export all registered moments"><Archive size={14} />{exporting === "all" ? "Exporting" : "Export all"}</Button></div>
            {exporting === "all" && exportStatus ? <p className="mt-2 text-[10px] leading-4 text-cyan-100">{exportStatus}</p> : null}
            {selectedMoment ? (
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="truncate text-[11px] font-medium text-cyan-100" title={selectedMoment.momentType.name}>
                  {selectedMoment.momentType.name}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {formatPreciseTime(selectedMoment.startTimeSeconds)} – {formatPreciseTime(selectedMoment.endTimeSeconds)}
                </p>
                <label className="mt-3 grid gap-1.5">
                  <span className="text-[10px] uppercase tracking-[.16em] text-slate-500">Export quality</span>
                  <Select className="h-8 text-xs" value={exportQuality} onChange={(event) => setExportQuality(event.target.value as ExportQuality)}>
                    {exportQualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                  <span className="text-[10px] leading-4 text-slate-500">{exportQualityOptions.find((option) => option.value === exportQuality)?.detail}</span>
                </label>
                <div className="mt-2 grid gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full"
                    disabled={Boolean(exporting) || !player.sourceUrl}
                    onClick={() => void exportSelectedMoment()}
                  >
                    <Download size={14} />
                    Export MP4 clip
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full px-2"
                    disabled={Boolean(exporting) || !player.sourceUrl}
                    onClick={() => void exportMomentType()}
                  >
                    <Archive size={14} />
                    All of this type ({match.moments.filter((moment) => moment.momentTypeId === selectedMoment.momentTypeId).length})
                  </Button>
                </div>
                {exportStatus ? <p className="mt-2 text-[10px] leading-4 text-cyan-100">{exportStatus}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-[10px] leading-4 text-slate-500">Select a row to review or export.</p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {match.moments.length === 0 ? (
              <p className="p-3 text-xs leading-5 text-slate-500">Completed moments appear here.</p>
            ) : (
              match.moments.map((moment) => (
                <div
                  key={moment.id}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-1.5 border-b border-white/[0.06] px-2.5 py-1 text-left transition hover:bg-white/[0.06]",
                    selectedMomentId === moment.id && "bg-cyan-300/10 text-cyan-100",
                  )}
                >
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2" onClick={() => reviewMoment(moment)} title={`${moment.momentType.name} · ${formatPreciseTime(moment.startTimeSeconds)}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: moment.momentType.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{moment.momentType.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{formatPreciseTime(moment.startTimeSeconds)}</span>
                  </button>
                  <OutcomeButtons compact value={moment.outcome} onChange={(outcome) => void toggleOutcome(moment, outcome)} />
                  <button type="button" className="inline-flex h-6 items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-1.5 text-[10px] font-medium text-cyan-100 hover:bg-cyan-300/20" onClick={() => setEditingMoment(moment)} aria-label="Edit moment"><Pencil size={11} />Edit</button>
                  <button type="button" className="inline-flex h-6 items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-1.5 text-[10px] font-medium text-red-100 hover:bg-red-500/25" onClick={() => void deleteMoment(moment)} aria-label="Delete moment"><Trash2 size={11} />Delete</button>
                </div>
              ))
            )}
          </div>
        </Panel>
        </div>

        <div className="min-h-0 min-w-0">
          <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="relative aspect-video shrink-0 bg-black xl:aspect-auto xl:min-h-0 xl:flex-1">
              {player.sourceUrl ? (
                <video
                  ref={player.videoRef}
                  src={player.sourceUrl}
                  crossOrigin="anonymous"
                  className="h-full w-full object-contain"
                  controls={false}
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={player.handleTimeUpdate}
                  onPlay={() => player.setIsPlaying(true)}
                  onPause={() => player.setIsPlaying(false)}
                  onEnded={() => { player.setIsPlaying(false); setVideoFinished(true); }}
                  onError={() => player.setError("Could not play this video. For better compatibility, use MP4 with H.264 codec.")}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <FileVideo className="text-cyan-200" size={56} />
                  <h2 className="mt-4 text-xl font-semibold text-white">Upload the match video</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                    The video will be stored privately in Cloudflare R2 and will be available on every device signed into this account.
                  </p>
                  {match.video ? <div className="mt-4 w-full max-w-lg rounded-md border border-cyan-300/25 bg-cyan-300/[.07] p-3 text-left"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-cyan-200/70">Expected video</p><p className="mt-1 truncate text-sm font-medium text-cyan-50">{match.video.fileName}</p><p className="mt-1 text-xs text-slate-400">{formatBytes(match.video.fileSize)} · {formatTime(match.video.durationSeconds)}</p></div> : <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-500/[.06] px-3 py-2 text-xs text-amber-100">No video has been associated with this match yet.</div>}
                  <Button className="mt-5" variant="primary" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} />
                    {match.video?.storageStatus === "READY" ? "Replace video" : "Choose video"}
                  </Button>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-pitch-950/90 p-2">
              <div className="grid gap-1.5">
                <input
                  type="range"
                  min="0"
                  max={Math.max(player.duration, 0.1)}
                  step="0.1"
                  value={Math.min(player.currentTime, player.duration || 0)}
                  disabled={!player.sourceUrl || !player.duration}
                  onChange={(event) => player.seekTo(Number(event.target.value))}
                  aria-label="Video position"
                  className="h-1.5 w-full cursor-pointer accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: player.duration ? `linear-gradient(to right, #67e8f9 ${(player.currentTime / player.duration) * 100}%, rgba(255,255,255,.14) ${(player.currentTime / player.duration) * 100}%)` : undefined }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex min-w-max items-center gap-1">
                  <Button size="icon" className="h-8 w-8" variant="secondary" onClick={() => player.seekBy(-15)} aria-label="Back 15 seconds">
                    <ChevronsLeft size={15} />
                  </Button>
                  <Button size="icon" className="h-8 w-8" variant="secondary" onClick={() => player.seekBy(-5)} aria-label="Back 5 seconds">
                    <RotateCcw size={15} />
                  </Button>
                  <Button size="icon" className="h-8 w-8" variant="primary" onClick={player.togglePlay} aria-label={player.isPlaying ? "Pause" : "Play"}>
                    {player.isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </Button>
                  <Button size="icon" className="h-8 w-8" variant="secondary" onClick={() => player.seekBy(5)} aria-label="Forward 5 seconds">
                    <ChevronsRight size={15} />
                  </Button>
                  <Button size="icon" className="h-8 w-8" variant="secondary" onClick={() => player.seekBy(15)} aria-label="Forward 15 seconds">
                    <ChevronsRight size={15} className="scale-125" />
                  </Button>
                  <div className="flex overflow-hidden rounded-md border border-white/10">
                    {[1, 2, 4].map((rate) => <button key={rate} type="button" className={cn("h-8 px-2 text-[10px] transition", player.playbackRate === rate ? "bg-cyan-300 text-slate-950" : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.1]")} onClick={() => player.setPlaybackRate(rate)}>{rate}×</button>)}
                  </div>
                  <Button size="icon" variant="danger" className="h-8 w-8" disabled={match.moments.length === 0} title="Delete the last recorded moment" aria-label="Delete the last recorded moment" onClick={() => { const last = match.moments[match.moments.length - 1]; if (last) void deleteMoment(last); }}><Trash2 size={14} /></Button>
                  <div className="ml-1 flex items-center gap-1 border-l border-white/10 pl-2" aria-label="Match periods">
                    {([[
                      "firstHalfStartSeconds", "1H start", "1H S"
                    ], ["firstHalfEndSeconds", "1H end", "1H E"], ["secondHalfStartSeconds", "2H start", "2H S"], ["secondHalfEndSeconds", "2H end", "2H E"]] as [PeriodMarkerKey, string, string][]).map(([key, label, short]) => { const seconds = match[key]; return <div key={key} className="flex overflow-hidden rounded-md border border-cyan-300/25"><button type="button" disabled={!player.sourceUrl} title={seconds === null ? `${label}: save current time` : `${label}: go to ${formatTime(seconds)}`} onClick={() => seconds === null ? void setPeriodMarker(key) : player.seekTo(seconds)} className="flex h-8 min-w-[3.5rem] flex-col items-center justify-center bg-cyan-300/[.06] px-1.5 leading-none disabled:opacity-40"><span className="text-[7px] font-bold uppercase tracking-wide text-cyan-200">{short}</span><span className="mt-0.5 font-mono text-[8px] text-slate-300">{seconds === null ? "Set" : formatTime(seconds)}</span></button>{seconds !== null ? <button type="button" disabled={!player.sourceUrl} aria-label={`Replace ${label}`} title={`Replace ${label} with current time`} onClick={() => void setPeriodMarker(key)} className="flex h-8 w-5 items-center justify-center border-l border-cyan-300/20 text-slate-500 hover:text-white"><Clock size={9} /></button> : null}</div>; })}
                  </div>
                  <form className="ml-1 flex items-center gap-1 border-l border-white/10 pl-2" onSubmit={(event) => { event.preventDefault(); goToExactTime(); }}><TextInput aria-label="Exact second" className="h-8 w-20 font-mono text-[10px]" type="number" min="0" max={player.duration || undefined} step="0.1" placeholder="Second" value={seekTime} onChange={(event) => setSeekTime(event.target.value)} disabled={!player.sourceUrl} /><Button type="submit" size="sm" className="h-8 px-2 text-[10px]" variant="secondary" disabled={!player.sourceUrl || seekTime === ""}>Go</Button></form>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-white"><Clock size={13} className="text-cyan-200" />{formatPreciseTime(player.currentTime)} / {formatTime(player.duration)}</span>
              </div>
              {player.error ? <p className="mt-1.5 rounded-md border border-red-400/30 bg-red-500/10 p-1.5 text-xs text-red-100">{player.error}</p> : null}
            </div>
          </Panel>
        </div>

        <aside className="hidden">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Main moments</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {momentTypes.map((type) => {
                  const active = activeMoments.some((moment) => moment.momentTypeId === type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={cn(
                        "flex min-h-14 items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition hover:bg-white/[0.08]",
                        active ? "border-cyan-200/70 bg-cyan-300/10 shadow-glow" : "border-white/10 bg-white/[0.04]",
                      )}
                      onClick={() => toggleMoment(type)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold" style={{ color: type.color }}>{type.name}</span>
                        {active ? <span className="mt-1 block text-[10px] text-cyan-100">A decorrer</span> : null}
                      </span>
                      <span className="shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {getShortcutForMomentType(type.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Match periods</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Mark the current video time, then use the saved button to jump to it.</p>
              <div className="mt-3 grid gap-2">
                {([
                  ["firstHalfStartSeconds", "Start 1st half"],
                  ["firstHalfEndSeconds", "End 1st half"],
                  ["secondHalfStartSeconds", "Start 2nd half"],
                  ["secondHalfEndSeconds", "End 2nd half"],
                ] as [PeriodMarkerKey, string][]).map(([key, label]) => {
                  const seconds = match[key];
                  return <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Button size="sm" variant={seconds === null ? "secondary" : "primary"} className="min-w-0 justify-between" onClick={() => seconds === null ? void setPeriodMarker(key) : player.seekTo(seconds)} disabled={!player.sourceUrl}>
                      <span className="truncate">{label}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px]">{seconds === null ? "Mark" : formatPreciseTime(seconds)}</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void setPeriodMarker(key)} disabled={!player.sourceUrl} aria-label={`Set ${label} to current time`} title="Replace with current time">
                      Set
                    </Button>
                  </div>;
                })}
              </div>
            </div>

            <div className="hidden">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submoments</p>
                {selectedMoment ? <span className="truncate text-[11px] text-cyan-100">{selectedMoment.momentType.name}</span> : null}
              </div>
              {!selectedMoment ? (
                <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-500">
                  Complete or select a moment on the left to identify submoments.
                </p>
              ) : selectedSubMomentTypes.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No submoments are configured for this moment.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectedSubMomentTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={cn(
                        "flex min-h-10 items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]",
                        pendingSubMoment?.subMomentType.id === type.id && "border-cyan-300/60 bg-cyan-300/10 text-cyan-100",
                      )}
                      onClick={() => void handleQuickAddSubMoment(type)}
                    >
                      <span className="min-w-0 truncate">{type.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{getShortcutForSubMomentType(type.id)}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedMoment ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Saved submoments</FieldLabel>
                    <span className="text-[11px] text-slate-500">{selectedMoment.subMoments.length}</span>
                  </div>
                  {selectedMoment.subMoments.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">There are no submoments in this moment yet.</p>
                  ) : (
                    <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-white/10">
                      {selectedMoment.subMoments.map((subMoment) => (
                        <div
                          key={subMoment.id}
                          className={cn(
                            "border-b border-white/[0.06] px-2.5 py-2 last:border-b-0",
                            selectedSubMomentId === subMoment.id && "bg-cyan-300/10 text-cyan-100",
                          )}
                        >
                          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => reviewSubMoment(subMoment)} title="Go to this submoment">
                            <Crosshair size={12} className="shrink-0 text-cyan-200" />
                            <span className="min-w-0 flex-1 truncate text-xs">{subMoment.subMomentType.name}</span>
                            <span className="shrink-0 font-mono text-[10px] text-slate-500">{subMoment.timeSeconds !== null ? formatPreciseTime(subMoment.timeSeconds) : "—"}</span>
                          </button>
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                            <OutcomeButtons value={subMoment.outcome} onChange={(outcome) => void toggleSubMomentOutcome(subMoment, outcome)} />
                            <Button size="sm" variant="secondary" className="h-7" onClick={() => setEditingSubMoment(subMoment)}><Pencil size={12} />Edit</Button>
                            <Button size="sm" variant="danger" className="h-7" onClick={() => void deleteSubMoment(subMoment)}><Trash2 size={12} />Delete</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {pendingSubMoment ? (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <FieldLabel>Field</FieldLabel>
                      <span className="text-[11px] text-slate-500">Mark the area</span>
                    </div>
                    <TacticalField value={pendingFieldPoint} markers={pendingFieldMarkers} onChange={setPendingFieldPoint} />
                  </div>
                  {requiresGoalLocationForSubMoment(pendingSubMoment.subMomentType) ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <FieldLabel>Goal</FieldLabel>
                        <span className="text-[11px] text-slate-500">Mark the target</span>
                      </div>
                      <GoalTarget value={pendingGoalPoint} markers={pendingGoalMarkers} onChange={setPendingGoalPoint} />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelPendingSubMoment}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!pendingFieldPoint || (requiresGoalLocationForSubMoment(pendingSubMoment.subMomentType) && !pendingGoalPoint) || savingPendingSubMoment}
                      onClick={() => void confirmPendingSubMoment()}
                    >
                      {savingPendingSubMoment ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : selectedMoment ? (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <FieldLabel>Field</FieldLabel>
                      <span className="text-[11px] text-slate-500">{selectedFieldMarkers.length} pontos</span>
                    </div>
                    <TacticalField
                      value={null}
                      markers={selectedFieldMarkers}
                      onChange={() => setNotice("Select a submoment first.")}
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <FieldLabel>Goal</FieldLabel>
                      <span className="text-[11px] text-slate-500">{selectedGoalMarkers.length} pontos</span>
                    </div>
                    <GoalTarget
                      value={null}
                      markers={selectedGoalMarkers}
                      onChange={() => setNotice("Select a finishing submoment first.")}
                    />
                  </div>
                  <p className="text-[11px] leading-4 text-slate-500">
                    Select a submoment in the list to jump to its timestamp.
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>

      <Panel className="flex shrink-0 items-center justify-between gap-3 px-3 py-1.5"><div className="min-w-0"><span className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">Identification</span><span className="ml-2 text-xs font-semibold text-white">Submoments</span></div><Link href={`/analysis/${match.id}/submoments`}><Button size="sm" variant="primary" className="h-8" disabled={match.moments.length === 0 || activeMoments.length > 0}>Identify submoments <ChevronsRight size={14} /></Button></Link></Panel>
      <Timeline moments={match.moments} duration={player.duration || match.video?.durationSeconds || 0} onSelect={reviewMoment} />

      {videoFinished && match.moments.length > 0 ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><Panel className="w-full max-w-lg border-cyan-300/30 p-6 text-center"><h2 className="text-xl font-semibold text-white">The video has ended</h2><p className="mt-2 text-sm text-slate-400">The main moments have been saved. You can now continue to submoment identification.</p><div className="mt-5 flex justify-center gap-2"><Button onClick={() => setVideoFinished(false)}>Stay here</Button><Link href={`/analysis/${match.id}/submoments`}><Button variant="primary">Edit submoments</Button></Link></div></Panel></div> : null}

      {editingMoment ? <MomentEditDialog moment={editingMoment} momentTypes={momentTypes} currentTime={player.currentTime} duration={player.duration || match.video?.durationSeconds || 0} onPreview={(start, end) => player.reviewSegment(start, end)} onSave={updateMoment} onClose={() => setEditingMoment(null)} /> : null}
      {editingSubMoment && selectedMoment ? <SubmomentEditDialog submoment={editingSubMoment} submomentTypes={getSubMomentTypesForMoment(subMomentTypes, selectedMoment.momentType)} momentStart={selectedMoment.startTimeSeconds} momentEnd={selectedMoment.endTimeSeconds} currentTime={player.currentTime} onSave={updateSubMoment} onClose={() => setEditingSubMoment(null)} /> : null}

      {notice ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-pitch-900 px-4 py-2 text-sm text-cyan-100 shadow-glow">
          {notice}
        </div>
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
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
  const rows = Array.from(
    moments.reduce((groups, moment) => {
      const existing = groups.get(moment.momentTypeId);
      if (existing) existing.moments.push(moment);
      else groups.set(moment.momentTypeId, { type: moment.momentType, moments: [moment] });
      return groups;
    }, new Map<string, { type: MomentTypeRecord; moments: MomentRecord[] }>()),
  ).map(([, row]) => row);

  return (
    <Panel className="flex shrink-0 flex-col overflow-hidden xl:h-24">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-2 py-1"><span className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">Timeline</span><Scissors size={12} className="text-cyan-200" /></div>
      <div className="min-h-0 flex-1 overflow-auto bg-black/20">
        <div className="min-w-[720px]">
        {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">No moments registered.</p> : rows.map((row) => (
          <div key={row.type.id} className="grid min-h-6 grid-cols-[8rem_minmax(0,1fr)] border-b border-white/[0.07] last:border-b-0">
            <div className="flex items-center gap-2 border-r border-white/[0.07] px-2 py-1">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.type.color }} />
              <span className="truncate text-[9px] text-slate-300" title={row.type.name}>{row.type.name}</span>
            </div>
            <div className="relative min-h-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              {row.moments.map((moment) => {
                const left = (moment.startTimeSeconds / timelineDuration) * 100;
                const width = Math.max(0.8, ((moment.endTimeSeconds - moment.startTimeSeconds) / timelineDuration) * 100);
                return <button key={moment.id} type="button" className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full border border-white/20 shadow-sm transition hover:h-4" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: row.type.color }} onClick={() => onSelect(moment)} title={`${row.type.code} ${formatPreciseTime(moment.startTimeSeconds)}${moment.outcome ? ` · ${moment.outcome}` : ""}`}><span className={cn("absolute -right-1 -top-1 h-2 w-2 rounded-full ring-1 ring-black", moment.outcome === "positive" ? "bg-emerald-400" : moment.outcome === "negative" ? "bg-red-400" : "hidden")} /></button>;
              })}
            </div>
          </div>
        ))}
        </div>
      </div>
    </Panel>
  );
}

function MomentListItem({
  moment,
  active,
  canExport,
  exporting,
  onReview,
  onExport,
  onDelete,
}: {
  moment: MomentRecord;
  active: boolean;
  canExport: boolean;
  exporting: boolean;
  onReview: (moment: MomentRecord) => void;
  onExport: (moment: MomentRecord) => Promise<void>;
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
        {moment.subMoments.length > 0 ? <p className="mt-2 text-xs text-cyan-100">{moment.subMoments.length} submoments</p> : null}
      </button>
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
        <Button size="sm" variant="secondary" onClick={() => onReview(moment)}>
          <Play size={14} />
          Review
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void onExport(moment)} disabled={!canExport || exporting}>
          <Download size={14} />
          {exporting ? "Exporting" : "Export"}
        </Button>
        <Button size="sm" variant="danger" onClick={() => void onDelete(moment.id)} aria-label="Delete moment">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

function SubMomentLocationDialog({
  pendingSubMoment,
  fieldPoint,
  goalPoint,
  fieldMarkers,
  goalMarkers,
  saving,
  onFieldPointChange,
  onGoalPointChange,
  onCancel,
  onSave,
}: {
  pendingSubMoment: PendingSubMoment;
  fieldPoint: Point | null;
  goalPoint: Point | null;
  fieldMarkers: SurfaceMarker[];
  goalMarkers: SurfaceMarker[];
  saving: boolean;
  onFieldPointChange: (point: Point) => void;
  onGoalPointChange: (point: Point) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const requiresGoalLocation = requiresGoalLocationForSubMoment(pendingSubMoment.subMomentType);
  const saveDisabled = saving || !fieldPoint || (requiresGoalLocation && !goalPoint);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/86 p-4">
      <Panel className="max-h-[92vh] w-full max-w-6xl overflow-y-auto border-cyan-300/30 bg-pitch-950 shadow-2xl backdrop-blur-none">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">{pendingSubMoment.subMomentType.name}</Badge>
              <span className="text-sm text-slate-400">{formatPreciseTime(pendingSubMoment.timeSeconds)}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">Mark submoment</h2>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onCancel}>
            <X size={17} />
          </Button>
        </div>

        <div className={cn("grid gap-4 p-4", requiresGoalLocation ? "lg:grid-cols-[minmax(0,1fr)_24rem]" : "")}>
          <div className="grid gap-2 rounded-md border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Field</FieldLabel>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Crosshair size={12} />
                {fieldPoint ? `${fieldPoint.x}%, ${fieldPoint.y}%` : "Click on the field"}
              </span>
            </div>
            <TacticalField value={fieldPoint} markers={fieldMarkers} onChange={onFieldPointChange} className="border-emerald-300/45" />
          </div>

          {requiresGoalLocation ? (
            <div className="grid content-start gap-2 rounded-md border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>Goal</FieldLabel>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Goal size={12} />
                  {goalPoint ? `${goalPoint.x}%, ${goalPoint.y}%` : "Click on the goal"}
                </span>
              </div>
              <GoalTarget value={goalPoint} markers={goalMarkers} onChange={onGoalPointChange} className="border-cyan-300/45" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/10 bg-black/35 p-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saveDisabled}>
            <Crosshair size={16} />
            {saving ? "Saving" : "Save submoment"}
          </Button>
        </div>
      </Panel>
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
        <h2 className="text-lg font-semibold text-white">Resume analysis</h2>
        <p className="mt-2 text-sm text-slate-400">This match already has saved moments. Choose where to position the video.</p>
        <div className="mt-5 grid gap-3">
          <Button variant="secondary" onClick={onStart}>
            Go to start
          </Button>
          <Button variant="secondary" disabled={!lastMoment} onClick={() => onLast(lastMoment?.endTimeSeconds ?? 0)}>
            Go to latest tag {lastMoment ? `(${formatPreciseTime(lastMoment.endTimeSeconds)})` : ""}
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextInput
              type="number"
              step="0.1"
              min="0"
              placeholder="Time in seconds"
              value={specificTime}
              onChange={(event) => onSpecificTimeChange(event.target.value)}
            />
            <Button variant="primary" onClick={onSpecific}>
              Go to time
            </Button>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Panel>
    </div>
  );
}
