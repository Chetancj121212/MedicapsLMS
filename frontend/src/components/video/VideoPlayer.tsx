"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";
import { Play } from "lucide-react";

interface YouTubePlayer {
  getCurrentTime?: () => number;
  getDuration?: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  destroy?: () => void;
}

interface YouTubeEvent {
  data: number;
  target: YouTubePlayer;
}

type Player = YouTubePlayer | HTMLVideoElement;

function getPlayerCurrentTime(player: Player | null): number | undefined {
  if (!player) return undefined;
  return player instanceof HTMLVideoElement
    ? player.currentTime
    : player.getCurrentTime?.();
}

function getPlayerDuration(player: Player | null): number | undefined {
  if (!player) return undefined;
  return player instanceof HTMLVideoElement
    ? player.duration
    : player.getDuration?.();
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLDivElement,
        options: Record<string, unknown>,
      ) => YouTubePlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Segment = [number, number];
type SourceType = "youtube" | "google_drive" | "local";

interface VideoPlayerProps {
  lectureId: number;
  videoUrl: string;
  videoSourceType?: SourceType;
  videoId?: string;
  initialPosition?: number;
  initialPercentage?: number;
  initialSegments?: Segment[];
  initialActiveScreenTime?: number;
  initialVideoPlayTime?: number;
  isCompleted?: boolean;
  onCompleted?: () => void;
  onProgressUpdate?: (
    percentage: number,
    completed: boolean,
    activePercentage?: number,
  ) => void;
}

function parseYoutubeId(url: string) {
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be")
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      return (
        parsed.searchParams.get("v") ||
        (parsed.pathname.split("/").filter(Boolean)[0] === "embed"
          ? parsed.pathname.split("/").filter(Boolean)[1]
          : null)
      );
    }
  } catch {
    return null;
  }
  return null;
}

function mergeSegments(segments: Segment[]) {
  const valid = segments
    .filter(
      ([start, end]) =>
        Number.isFinite(start) && Number.isFinite(end) && end > start,
    )
    .sort((a, b) => a[0] - b[0]);
  const merged: Segment[] = [];
  for (const segment of valid) {
    const last = merged[merged.length - 1];
    if (last && segment[0] <= last[1] + 0.5)
      last[1] = Math.max(last[1], segment[1]);
    else merged.push([Math.max(0, segment[0]), Math.max(0, segment[1])]);
  }
  return merged.map(
    ([start, end]) =>
      [Number(start.toFixed(2)), Number(end.toFixed(2))] as Segment,
  );
}

const uniqueSeconds = (segments: Segment[]) =>
  mergeSegments(segments).reduce((sum, [start, end]) => sum + end - start, 0);
const focused = () =>
  document.visibilityState === "visible" && document.hasFocus();

export function VideoPlayer({
  lectureId,
  videoUrl,
  videoSourceType,
  videoId,
  initialPosition = 0,
  initialPercentage = 0,
  initialSegments = [],
  initialActiveScreenTime = 0,
  initialVideoPlayTime = 0,
  isCompleted = false,
  onCompleted,
  onProgressUpdate,
}: VideoPlayerProps) {
  const sourceType =
    videoSourceType || (parseYoutubeId(videoUrl) ? "youtube" : "local");
  const resolvedId =
    videoId || (sourceType === "youtube" ? parseYoutubeId(videoUrl) : null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const segmentsRef = useRef<Segment[]>(initialSegments);
  const segmentStartRef = useRef<number | null>(null);
  const lastPositionRef = useRef(initialPosition);
  const activeTimeRef = useRef(initialActiveScreenTime);
  const playTimeRef = useRef(initialVideoPlayTime);
  const playingRef = useRef(false);
  const lastTickRef = useRef(Date.now());
  const inFlightRef = useRef(false);
  const syncRef = useRef<(finalize?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const completedRef = useRef(isCompleted);
  const [duration, setDuration] = useState<number | null>(null);
  const [watchPercentage, setWatchPercentage] = useState(initialPercentage);
  const [activePercentage, setActivePercentage] = useState(0);
  const [ready, setReady] = useState(sourceType !== "youtube");

  const finishSegment = useCallback((end = lastPositionRef.current) => {
    if (segmentStartRef.current !== null && end > segmentStartRef.current + 0.2)
      segmentsRef.current.push([segmentStartRef.current, end]);
    segmentStartRef.current = null;
  }, []);

  const sync = useCallback(
    async (finalize = false) => {
      if (inFlightRef.current) return;
      const player = playerRef.current;
      const current =
        Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) || 0;
      if (finalize) finishSegment(current);
      const merged = mergeSegments(segmentsRef.current);
      const watched = uniqueSeconds(merged);
      const playerDuration = Number(getPlayerDuration(player) ?? duration ?? 0);
      inFlightRef.current = true;
      try {
        const response = await fetchApi<{
          completion_percentage: number;
          completed: boolean;
          active_screen_time_seconds: number;
        }>(`/api/lectures/${lectureId}/progress`, {
          method: "POST",
          body: JSON.stringify({
            watched_seconds: watched,
            completion_percentage: playerDuration
              ? (watched / playerDuration) * 100
              : 0,
            last_position_seconds: current,
            segments: merged,
            duration: playerDuration || undefined,
            video_play_time_seconds: playTimeRef.current,
            active_screen_time_seconds: activeTimeRef.current,
            last_activity_at: new Date().toISOString(),
          }),
        });
        const activePct = playerDuration
          ? Math.min(
              100,
              (response.active_screen_time_seconds / playerDuration) * 100,
            )
          : 0;
        setWatchPercentage(response.completion_percentage || 0);
        setActivePercentage(activePct);
        onProgressUpdate?.(
          response.completion_percentage || 0,
          response.completed,
          activePct,
        );
        if (response.completed && !completedRef.current) {
          completedRef.current = true;
          onCompleted?.();
        }
      } catch (error) {
        console.warn("Failed to sync lecture progress:", error);
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      duration,
      finishSegment,
      lectureId,
      onCompleted,
      onProgressUpdate,
      sourceType,
    ],
  );
  syncRef.current = sync;

  useEffect(() => {
    if (sourceType !== "youtube" || !resolvedId || !containerRef.current)
      return;
    const createPlayer = () => {
      const youtube = window.YT;
      if (!containerRef.current || !youtube?.Player) return;
      playerRef.current = new youtube.Player(containerRef.current, {
        videoId: resolvedId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          fs: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event: YouTubeEvent) => {
            setReady(true);
            const length = Number(event.target.getDuration?.() || 0);
            if (length) setDuration(length);
            if (initialPosition > 0)
              event.target.seekTo?.(initialPosition, true);
          },
          onStateChange: (event: YouTubeEvent) => {
            const current = Number(
              event.target.getCurrentTime?.() || lastPositionRef.current,
            );
            playingRef.current = event.data === youtube.PlayerState.PLAYING;
            if (playingRef.current) segmentStartRef.current ??= current;
            else if (
              event.data === youtube.PlayerState.PAUSED ||
              event.data === youtube.PlayerState.ENDED
            ) {
              finishSegment(current);
              void syncRef.current(true);
            }
          },
        },
      });
    };
    if (window.YT?.Player) createPlayer();
    else {
      const script =
        document.querySelector(
          "script[src='https://www.youtube.com/iframe_api']",
        ) || document.createElement("script");
      if (!script.parentNode) {
        script.setAttribute("src", "https://www.youtube.com/iframe_api");
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = createPlayer;
    }
    return () => {
      const player = playerRef.current;
      if (player && !(player instanceof HTMLVideoElement)) player.destroy?.();
      playerRef.current = null;
    };
  }, [finishSegment, initialPosition, resolvedId, sourceType]);

  useEffect(() => {
    if (sourceType !== "google_drive") return;
    const handleMessage = (event: MessageEvent) => {
      const value = (
        typeof event.data === "string"
          ? event.data
          : JSON.stringify(event.data || {})
      ).toLowerCase();
      if (!/(play|pause|end)/.test(value)) return;
      playingRef.current = value.includes("play") && !value.includes("pause");
      if (playingRef.current)
        segmentStartRef.current ??= lastPositionRef.current;
      else {
        finishSegment();
        void syncRef.current(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [finishSegment, sourceType]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(2, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (!playingRef.current || !focused()) return;
      activeTimeRef.current += elapsed;
      playTimeRef.current += elapsed;
      const player = playerRef.current;
      const current =
        Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) ||
        lastPositionRef.current;
      if (sourceType === "youtube") {
        if (segmentStartRef.current === null) segmentStartRef.current = current;
        if (Math.abs(current - lastPositionRef.current) > 1.5) {
          finishSegment(lastPositionRef.current);
          segmentStartRef.current = current;
        }
        lastPositionRef.current = current;
      }
      const length = Number(getPlayerDuration(player) ?? duration ?? 0);
      if (length)
        setActivePercentage(
          Math.min(100, (activeTimeRef.current / length) * 100),
        );
      if (now % 7000 < 1100) void syncRef.current();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration, finishSegment, sourceType]);

  useEffect(() => {
    const flush = () => {
      finishSegment();
      void syncRef.current(true);
    };
    const focus = () => {
      lastTickRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("blur", flush);
    window.addEventListener("focus", focus);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("blur", flush);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", flush);
    };
  }, [finishSegment]);

  if (sourceType === "google_drive" && videoId)
    return (
      <div className="space-y-2">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-border-subtle">
          <iframe
            title="Google Drive lecture video"
            src={`https://drive.google.com/file/d/${videoId}/preview`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay"
          />
        </div>
        <ProgressLabel
          watched={watchPercentage}
          active={activePercentage}
          limited
        />
      </div>
    );
  if (sourceType === "local")
    return (
      <div className="space-y-2">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-border-subtle">
          <video
            className="absolute inset-0 w-full h-full"
            controls
            src={videoUrl}
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              playerRef.current = element;
              setDuration(element.duration);
              if (initialPosition > 0) element.currentTime = initialPosition;
            }}
            onPlay={(event) => {
              playerRef.current = event.currentTarget;
              playingRef.current = true;
              segmentStartRef.current ??= event.currentTarget.currentTime;
            }}
            onPause={(event) => {
              playingRef.current = false;
              finishSegment(event.currentTarget.currentTime);
              void sync(true);
            }}
            onEnded={(event) => {
              playingRef.current = false;
              finishSegment(event.currentTarget.currentTime);
              void sync(true);
            }}
            onTimeUpdate={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
          />
        </div>
        <ProgressLabel watched={watchPercentage} active={activePercentage} />
      </div>
    );
  if (!resolvedId)
    return (
      <div className="relative bg-[#F7F8FA] border border-border-subtle rounded-xl aspect-video flex items-center justify-center text-center p-8">
        <div>
          <Play className="w-5 h-5 mx-auto mb-2 text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">
            Video Unavailable
          </h3>
          <p className="text-xs text-text-secondary">
            This lecture does not have a valid supported video link.
          </p>
        </div>
      </div>
    );
  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-border-subtle">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
      <ProgressLabel watched={watchPercentage} active={activePercentage} />
    </div>
  );
}

function ProgressLabel({
  watched,
  active,
  limited = false,
}: {
  watched: number;
  active: number;
  limited?: boolean;
}) {
  return (
    <div className="space-y-1 text-xs text-text-secondary">
      <div className="flex justify-between">
        <span>
          Video watched:{" "}
          <b className="text-primary">{Math.round(watched)}%</b>
        </span>
        <span>
          Active screen time:{" "}
          <b className="text-primary">{Math.round(active)}%</b>
        </span>
      </div>
      {limited && (
        <p className="text-[11px]">
          Google Drive reports activity only when its preview player exposes it.
        </p>
      )}
    </div>
  );
}
