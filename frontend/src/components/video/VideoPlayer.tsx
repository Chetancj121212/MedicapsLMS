"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";
import { Pause, Play } from "lucide-react";

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
  onNext?: () => void;
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
  duration: initialDuration,
  initialPosition = 0,
  initialPercentage = 0,
  initialActiveScreenTime = 0,
  initialVideoPlayTime = 0,
  isCompleted = false,
  onCompleted,
  onNext,
  onProgressUpdate,
}: VideoPlayerProps) {
  const sourceType =
    videoSourceType || (parseYoutubeId(videoUrl) ? "youtube" : "local");
  const resolvedId =
    sourceType === "youtube" ? parseYoutubeId(videoId || videoUrl) : null;
  const resumePosition = isCompleted ? 0 : initialPosition;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const lastPositionRef = useRef(resumePosition);
  const activeTimeRef = useRef(initialActiveScreenTime);
  const playTimeRef = useRef(initialVideoPlayTime);
  const playingRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const syncRef = useRef<(finalize?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const completedRef = useRef(isCompleted);
  const isCompletedRef = useRef(isCompleted);
  const onNextRef = useRef(onNext);
  const endHandledRef = useRef(false);
  const initialPositionRef = useRef(resumePosition);

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    initialPositionRef.current = isCompleted ? 0 : initialPosition;
    isCompletedRef.current = isCompleted;
    if (isCompleted) lastPositionRef.current = 0;
  }, [initialPosition, isCompleted]);

  const handlePlaybackEnded = useCallback(() => {
    if (endHandledRef.current) return;
    endHandledRef.current = true;
    void syncRef.current(true);
    if (onNextRef.current) setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      onNextRef.current?.();
      queueMicrotask(() => setCountdown(null));
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

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
          lastPositionRef.current === 0 &&
          !isCompletedRef.current
        ) {
          lastPositionRef.current = data.last_position_seconds;
        }
        if (data.completed && !completedRef.current) {
          completedRef.current = true;
          setWatchPercentage(100);
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
      queueMicrotask(() => {
        setWatchPercentage(100);
      });
    }
  }, [isCompleted]);

  const sync = useCallback(
    async (finalize = false) => {
      void finalize;
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
        onProgressUpdate?.(effectiveWatchPct, response.completed, activePct);

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

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

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
            const length = Number(event.target.getDuration?.() || 0);
            if (length > 0) {
              setDuration(length);
              if (playTimeRef.current > 0) {
                void syncRef.current(false);
              }
            }
            const resumePos =
              initialPositionRef.current > 0
                ? initialPositionRef.current
                : lastPositionRef.current;
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
            if (playing) endHandledRef.current = false;

            // Persist immediately on pause or end
            if (event.data === window.YT?.PlayerState.ENDED) {
              handlePlaybackEnded();
            } else if (event.data === window.YT?.PlayerState.PAUSED) {
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
  }, [handlePlaybackEnded, resolvedId, sourceType]);

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
        if (value.includes("end")) handlePlaybackEnded();
        else void syncRef.current(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handlePlaybackEnded, sourceType]);

  // High-accuracy 1-second tracking loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const lastTick = lastTickRef.current ?? now;
      const elapsed = Math.min(2, (now - lastTick) / 1000);
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
        <VideoProgressBar playing={isPlaying} progress={watchPercentage} />
        {countdown !== null && onNext && (
          <NextLecturePrompt countdown={countdown} onNext={onNext} />
        )}
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
              endHandledRef.current = false;
              playingRef.current = true;
              setIsPlaying(true);
            }}
            onPlaying={() => {
              endHandledRef.current = false;
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
              handlePlaybackEnded();
            }}
            onTimeUpdate={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
          />
        </div>
        <VideoProgressBar playing={isPlaying} progress={watchPercentage} />
        {countdown !== null && onNext && (
          <NextLecturePrompt countdown={countdown} onNext={onNext} />
        )}
      </div>
    );

  if (!resolvedId)
    return (
      <div className="relative bg-page-bg border border-border-subtle rounded-xl aspect-video flex items-center justify-center text-center p-8">
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
      <VideoProgressBar playing={isPlaying} progress={watchPercentage} />
      {countdown !== null && onNext && (
        <NextLecturePrompt countdown={countdown} onNext={onNext} />
      )}
    </div>
  );
}

function NextLecturePrompt({
  countdown,
  onNext,
}: {
  countdown: number;
  onNext: () => void;
}) {
  const progress = Math.max(0, Math.min(100, (countdown / 3) * 100));

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-page-bg px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-text-secondary">
          Next in {countdown > 0 ? countdown : 1}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Next
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function VideoProgressBar({
  progress,
  playing,
}: {
  progress: number;
  playing: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="space-y-1.5">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div className="absolute inset-0 rounded-full bg-linear-to-r from-slate-200/30 via-slate-100/20 to-transparent" />
        <div
          className="relative h-full rounded-full bg-linear-to-r from-primary via-[#c4172c] to-[#d60528] shadow-[0_0_8px_rgba(214,5,40,0.22)] transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        >
          <div className="absolute inset-y-0 left-0 w-1/4 rounded-r-full bg-linear-to-r from-white/25 via-white/10 to-transparent" />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-page-bg text-primary"
            aria-label={playing ? "Video playing" : "Video paused"}
          >
            {playing ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3 ml-0.5" />
            )}
          </span>
          <span>{playing ? "Playing" : "Paused"}</span>
        </div>
        <span>{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}
