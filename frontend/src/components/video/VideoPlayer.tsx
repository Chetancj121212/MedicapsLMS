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
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type SourceType = "youtube" | "google_drive" | "local";

interface VideoPlayerProps {
  lectureId: number;
  videoUrl: string;
  videoSourceType?: SourceType;
  videoId?: string;
  completionThreshold?: number;
  duration?: number;
  initialPosition?: number;
  initialPercentage?: number;
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

const focused = () =>
  typeof document !== "undefined" &&
  document.visibilityState === "visible" &&
  document.hasFocus();

export function VideoPlayer({
  lectureId,
  videoUrl,
  videoSourceType,
  videoId,
  completionThreshold,
  duration: initialDuration,
  initialPosition = 0,
  initialPercentage = 0,
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

  const [threshold, setThreshold] = useState<number>(
    completionThreshold && completionThreshold > 0 ? completionThreshold : 90,
  );
  const [duration, setDuration] = useState<number | null>(
    initialDuration && initialDuration > 0 ? initialDuration : null,
  );
  const [watchPercentage, setWatchPercentage] = useState(
    isCompleted
      ? 100
      : initialPercentage > 0
        ? initialPercentage
        : initialDuration && initialDuration > 0
          ? Math.min(100, (initialVideoPlayTime / initialDuration) * 100)
          : 0,
  );
  const [activePercentage, setActivePercentage] = useState(
    isCompleted
      ? 100
      : initialDuration && initialDuration > 0
        ? Math.min(100, (initialActiveScreenTime / initialDuration) * 100)
        : 0,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(sourceType !== "youtube");

  // Dynamically fetch threshold & latest progress on mount from existing API endpoint
  useEffect(() => {
    let isCancelled = false;
    fetchApi<{
      completion_threshold?: number;
      video_play_time_seconds?: number;
      watched_seconds?: number;
      active_screen_time_seconds?: number;
      last_position_seconds?: number;
      completion_percentage?: number;
      completed?: boolean;
    }>(`/api/lectures/${lectureId}/progress`)
      .then((data) => {
        if (isCancelled || !data) return;
        if (
          typeof data.completion_threshold === "number" &&
          data.completion_threshold > 0
        ) {
          setThreshold(data.completion_threshold);
        }
        if (
          typeof data.video_play_time_seconds === "number" &&
          data.video_play_time_seconds > playTimeRef.current
        ) {
          playTimeRef.current = data.video_play_time_seconds;
        } else if (
          typeof data.watched_seconds === "number" &&
          data.watched_seconds > playTimeRef.current
        ) {
          playTimeRef.current = data.watched_seconds;
        }
        if (
          typeof data.active_screen_time_seconds === "number" &&
          data.active_screen_time_seconds > activeTimeRef.current
        ) {
          activeTimeRef.current = data.active_screen_time_seconds;
        }
        if (
          typeof data.last_position_seconds === "number" &&
          lastPositionRef.current === 0
        ) {
          lastPositionRef.current = data.last_position_seconds;
        }
        if (data.completed && !completedRef.current) {
          completedRef.current = true;
          setWatchPercentage(100);
          setActivePercentage(100);
          onCompleted?.();
        } else if (typeof data.completion_percentage === "number") {
          setWatchPercentage(data.completion_percentage);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [lectureId, onCompleted]);

  useEffect(() => {
    if (isCompleted) {
      completedRef.current = true;
      setWatchPercentage(100);
      setActivePercentage(100);
    }
  }, [isCompleted]);

  const sync = useCallback(
    async (finalize = false) => {
      if (inFlightRef.current) return;
      const player = playerRef.current;
      const current =
        Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) || 0;
      const playerDuration = Number(getPlayerDuration(player) ?? duration ?? 0);
      inFlightRef.current = true;
      try {
        const response = await fetchApi<{
          completion_percentage: number;
          completed: boolean;
          active_screen_time_seconds: number;
          video_play_time_seconds: number;
          completion_threshold: number;
        }>(`/api/lectures/${lectureId}/progress`, {
          method: "POST",
          body: JSON.stringify({
            watched_seconds: playTimeRef.current,
            completion_percentage: playerDuration
              ? (playTimeRef.current / playerDuration) * 100
              : 0,
            last_position_seconds: current,
            duration: playerDuration || undefined,
            video_play_time_seconds: playTimeRef.current,
            active_screen_time_seconds: activeTimeRef.current,
            last_activity_at: new Date().toISOString(),
          }),
        });

        if (
          response.completion_threshold &&
          response.completion_threshold > 0
        ) {
          setThreshold(response.completion_threshold);
        }

        const activePct = playerDuration
          ? Math.min(
              100,
              (response.active_screen_time_seconds / playerDuration) * 100,
            )
          : 0;

        const effectiveWatchPct = response.completed
          ? 100
          : response.completion_percentage || 0;

        setWatchPercentage(effectiveWatchPct);
        setActivePercentage(response.completed ? 100 : activePct);

        onProgressUpdate?.(
          effectiveWatchPct,
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
    [duration, lectureId, onCompleted, onProgressUpdate],
  );
  syncRef.current = sync;

  // YouTube IFrame Player
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
            if (length > 0) {
              setDuration(length);
              if (playTimeRef.current > 0) {
                void syncRef.current(false);
              }
            }
            const resumePos =
              initialPosition > 0 ? initialPosition : lastPositionRef.current;
            if (resumePos > 0) {
              event.target.seekTo?.(resumePos, true);
            }
          },
          onStateChange: (event: YouTubeEvent) => {
            const current = Number(
              event.target.getCurrentTime?.() || lastPositionRef.current,
            );
            lastPositionRef.current = current;

            // YouTube PlayerState: PLAYING = 1
            const playing = event.data === window.YT?.PlayerState.PLAYING;
            playingRef.current = playing;
            setIsPlaying(playing);

            // Persist immediately on pause or end
            if (
              event.data === window.YT?.PlayerState.PAUSED ||
              event.data === window.YT?.PlayerState.ENDED
            ) {
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
  }, [initialPosition, resolvedId, sourceType]);

  // Google Drive preview message handling
  useEffect(() => {
    if (sourceType !== "google_drive") return;
    const handleMessage = (event: MessageEvent) => {
      const value = (
        typeof event.data === "string"
          ? event.data
          : JSON.stringify(event.data || {})
      ).toLowerCase();
      if (!/(play|pause|end)/.test(value)) return;
      const isPlay = value.includes("play") && !value.includes("pause");
      playingRef.current = isPlay;
      setIsPlaying(isPlay);
      if (!isPlay) {
        void syncRef.current(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sourceType]);

  // High-accuracy 1-second tracking loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(2, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      const player = playerRef.current;
      const current =
        Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) ||
        lastPositionRef.current;
      lastPositionRef.current = current;

      const isPlay = playingRef.current;
      const isTabActive = focused();

      if (isPlay) {
        // 1. Video Watch Progress: count playback time only when playing
        playTimeRef.current += elapsed;

        // 2. Active Screen Time: count only when PLAYING and tab is visible & window focused
        if (isTabActive) {
          activeTimeRef.current += elapsed;
        }
      }

      const length = Number(getPlayerDuration(player) ?? duration ?? 0);
      if (length > 0) {
        // Calculate video watch percentage using total accumulated playback time / lecture duration
        const watchPct = Math.min(100, (playTimeRef.current / length) * 100);
        setWatchPercentage(watchPct);

        const activePct = Math.min(
          100,
          (activeTimeRef.current / length) * 100,
        );
        setActivePercentage(activePct);
      }

      // Sync periodically every 3 seconds while playing
      if (now % 3000 < 1100 && isPlay) {
        void syncRef.current();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [duration]);

  // Persist on visibility change, blur, and page exit
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      void syncRef.current(true);
    };

    const handleFocus = () => {
      lastTickRef.current = Date.now();
    };

    const handlePageExit = () => {
      void syncRef.current(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    window.addEventListener("blur", handleVisibilityOrBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      window.removeEventListener("blur", handleVisibilityOrBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, []);

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
          threshold={threshold}
          playing={isPlaying}
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
              if (element.duration > 0) {
                setDuration(element.duration);
                if (playTimeRef.current > 0) {
                  void sync(false);
                }
              }
              const resumePos =
                initialPosition > 0 ? initialPosition : lastPositionRef.current;
              if (resumePos > 0 && element.currentTime === 0) {
                element.currentTime = resumePos;
              }
            }}
            onPlay={() => {
              playingRef.current = true;
              setIsPlaying(true);
            }}
            onPlaying={() => {
              playingRef.current = true;
              setIsPlaying(true);
            }}
            onPause={(event) => {
              playingRef.current = false;
              setIsPlaying(false);
              lastPositionRef.current = event.currentTarget.currentTime;
              void sync(true);
            }}
            onWaiting={() => {
              // Buffering state: stop counting!
              playingRef.current = false;
              setIsPlaying(false);
            }}
            onSeeking={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
            onSeeked={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
              const isPlay =
                !event.currentTarget.paused && !event.currentTarget.ended;
              playingRef.current = isPlay;
              setIsPlaying(isPlay);
            }}
            onEnded={(event) => {
              playingRef.current = false;
              setIsPlaying(false);
              lastPositionRef.current = event.currentTarget.currentTime;
              void sync(true);
            }}
            onTimeUpdate={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
          />
        </div>
        <ProgressLabel
          watched={watchPercentage}
          active={activePercentage}
          threshold={threshold}
          playing={isPlaying}
        />
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
      <ProgressLabel
        watched={watchPercentage}
        active={activePercentage}
        threshold={threshold}
        playing={isPlaying}
      />
    </div>
  );
}

function ProgressLabel({
  watched,
  active,
  threshold = 90,
  playing = false,
  limited = false,
}: {
  watched: number;
  active: number;
  threshold?: number;
  playing?: boolean;
  limited?: boolean;
}) {
  return (
    <div className="space-y-1.5 text-xs text-text-secondary">
      <div className="flex justify-between items-center">
        <span>
          Video watched:{" "}
          <b className="text-primary">{Math.round(watched)}%</b>
          <span className="text-[11px] text-text-muted ml-1">
            (target: {Math.round(threshold)}%)
          </span>
        </span>
        {!playing && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ef4444",
                display: "inline-block",
              }}
            />
            Paused — not tracking
          </span>
        )}
        {playing && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            Tracking progress
          </span>
        )}
        <span>
          Active screen time:{" "}
          <b className="text-primary">{Math.round(active)}%</b>
          <span className="text-[11px] text-text-muted ml-1">(min: 60%)</span>
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
