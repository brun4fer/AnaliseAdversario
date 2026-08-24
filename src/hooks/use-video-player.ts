"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "@/lib/time";

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reviewEndRef = useRef<number | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const unload = useCallback(() => {
    setSourceUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setFile(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
    reviewEndRef.current = null;
  }, []);

  const loadFile = useCallback(
    (nextFile: File) => {
      unload();
      const url = URL.createObjectURL(nextFile);
      setFile(nextFile);
      setSourceUrl(url);
    },
    [unload],
  );

  const loadUrl = useCallback(
    (url: string) => {
      unload();
      setSourceUrl(url);
    },
    [unload],
  );

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      setError("Could not play this video. For better compatibility, use MP4 with H.264 codec.");
    }
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      void play();
    } else {
      pause();
    }
  }, [pause, play]);

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      const nextTime = clamp(seconds, 0, duration || video.duration || Number.MAX_SAFE_INTEGER);
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const seekBy = useCallback(
    (seconds: number) => {
      seekTo((videoRef.current?.currentTime ?? currentTime) + seconds);
    },
    [currentTime, seekTo],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setPlaybackRateState(rate);
  }, []);

  const reviewSegment = useCallback(
    (start: number, end: number) => {
      reviewEndRef.current = end;
      seekTo(start);
      void play();
    },
    [play, seekTo],
  );

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return 0;
    }

    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration);
    setError(null);
    return nextDuration;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setCurrentTime(video.currentTime);
    if (reviewEndRef.current !== null && video.currentTime >= reviewEndRef.current) {
      video.pause();
      setIsPlaying(false);
      reviewEndRef.current = null;
    }
  }, []);

  useEffect(() => unload, [unload]);

  return {
    videoRef,
    sourceUrl,
    file,
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    error,
    loadFile,
    loadUrl,
    unload,
    play,
    pause,
    togglePlay,
    seekTo,
    seekBy,
    setPlaybackRate,
    reviewSegment,
    handleLoadedMetadata,
    handleTimeUpdate,
    setError,
    setIsPlaying,
  };
}
