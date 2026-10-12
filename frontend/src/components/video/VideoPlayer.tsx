"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";
import { Pause, Play, CheckCircle2, ChevronRight, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

function mergeSegments(
  segments: Array<[number, number]>,
  maxDuration?: number,
): Array<[number, number]> {
  if (!segments || segments.length === 0) return [];
  const valid: Array<[number, number]> = [];
  for (const item of segments) {
    if (Array.isArray(item) && item.length === 2) {
      const s = Math.max(0, Number(item[0]) || 0);
      const e = maxDuration
        ? Math.min(Math.max(0, Number(item[1]) || 0), maxDuration)
        : Math.max(0, Number(item[1]) || 0);
      if (e > s) {
        valid.push([Math.round(s * 10) / 10, Math.round(e * 10) / 10]);
      }
    }
  }
  if (valid.length === 0) return [];
  valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const cur = valid[i];
    const prev = merged[merged.length - 1];
    if (cur[0] <= prev[1] + 0.5) {
      prev[1] = Math.max(prev[1], cur[1]);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function calculateUniqueWatched(segments: Array<[number, number]>): number {
  return segments.reduce((sum, [s, e]) => sum + (e - s), 0);
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
  hasNext?: boolean;
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
  document.visibilityState === "visible";

export function VideoPlayer({
  lectureId,
  videoUrl,
  videoSourceType,
  videoId,
  completionThreshold = 90,
  duration: initialDuration,
  initialPosition = 0,
  initialPercentage = 0,
  initialActiveScreenTime = 0,
  initialVideoPlayTime = 0,
  isCompleted = false,
  hasNext = true,
  onCompleted,
  onNext,
  onProgressUpdate,
}: VideoPlayerProps) {
  const sourceType =
    videoSourceType || (parseYoutubeId(videoUrl) ? "youtube" : "local");
  const resolvedId =
    sourceType === "youtube" ? parseYoutubeId(videoId || videoUrl) : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  // Stable callback & prop refs to prevent player re-initialization
  const onCompletedRef = useRef(onCompleted);
  const onNextRef = useRef(onNext);
  const onProgressUpdateRef = useRef(onProgressUpdate);
  const thresholdRef = useRef(completionThreshold);
  const isCompletedRef = useRef(isCompleted);
  const completedRef = useRef(isCompleted);
  const hasResumedRef = useRef(false);
  const initialPositionRef = useRef(isCompleted ? 0 : initialPosition);
  const endHandledRef = useRef(false);
  const inFlightRef = useRef(false);

  // High-precision tracking refs
  const durationRef = useRef<number>(initialDuration && initialDuration > 0 ? initialDuration : 0);
  const lastPositionRef = useRef<number>(isCompleted ? 0 : initialPosition);
  const playTimeRef = useRef<number>(initialVideoPlayTime);
  const activeTimeRef = useRef<number>(initialActiveScreenTime);
  const watchedSegmentsRef = useRef<Array<[number, number]>>([]);
  const currentSegmentStartRef = useRef<number | null>(null);
  const playingRef = useRef<boolean>(false);
  const lastTickRef = useRef<number | null>(null);

  const syncRef = useRef<(finalize?: boolean) => Promise<void>>(async () => undefined);
  const handlePlaybackEndedRef = useRef<() => Promise<void>>(async () => undefined);

  // Rendering state
  const [duration, setDuration] = useState<number | null>(
    initialDuration && initialDuration > 0 ? initialDuration : null,
  );
  const [watchPercentage, setWatchPercentage] = useState<number>(
    isCompleted
      ? 100
      : initialPercentage > 0
        ? initialPercentage
        : initialDuration && initialDuration > 0 && initialVideoPlayTime > 0
          ? Math.min(100, Math.round((initialVideoPlayTime / initialDuration) * 100))
          : 0,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [completedState, setCompletedState] = useState(isCompleted);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  useEffect(() => {
    thresholdRef.current = completionThreshold;
  }, [completionThreshold]);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
    if (isCompleted) {
      completedRef.current = true;
      setCompletedState(true);
      setWatchPercentage(100);
      lastPositionRef.current = 0;
    }
  }, [isCompleted]);

  // Next lecture countdown timer
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

  // Initial progress & threshold query on mount
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
        if (typeof data.completion_threshold === "number" && data.completion_threshold > 0) {
          thresholdRef.current = data.completion_threshold;
        }
        if (typeof data.video_play_time_seconds === "number" && data.video_play_time_seconds > playTimeRef.current) {
          playTimeRef.current = data.video_play_time_seconds;
        } else if (typeof data.watched_seconds === "number" && data.watched_seconds > playTimeRef.current) {
          playTimeRef.current = data.watched_seconds;
        }
        if (typeof data.active_screen_time_seconds === "number" && data.active_screen_time_seconds > activeTimeRef.current) {
          activeTimeRef.current = data.active_screen_time_seconds;
        }
        if (
          typeof data.last_position_seconds === "number" &&
          data.last_position_seconds > 0 &&
          lastPositionRef.current === 0 &&
          !isCompletedRef.current
        ) {
          initialPositionRef.current = data.last_position_seconds;
          lastPositionRef.current = data.last_position_seconds;
        }
        if (data.completed && !completedRef.current) {
          console.log(`[LECTURE_COMPLETION] eligible=true lectureId=${lectureId} from initial API status`);
          completedRef.current = true;
          setCompletedState(true);
          setWatchPercentage(100);
          onCompletedRef.current?.();
        } else if (typeof data.completion_percentage === "number" && !completedRef.current) {
          setWatchPercentage(data.completion_percentage);
        }
      })
      .catch((err) => {
        console.warn("[VIDEO_ERROR] Could not fetch initial progress:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [lectureId]);

  // Central progress synchronization
  const sync = useCallback(
    async (finalize = false) => {
      if (inFlightRef.current) return;
      const player = playerRef.current;
      const current = Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) || lastPositionRef.current;
      const dur = Number(durationRef.current || getPlayerDuration(player) || 0);

      // Collect all continuous segments
      const allSegments = [...watchedSegmentsRef.current];
      if (playingRef.current && currentSegmentStartRef.current !== null) {
        const segStart = currentSegmentStartRef.current;
        if (current > segStart) {
          allSegments.push([segStart, current]);
        }
      }
      const merged = mergeSegments(allSegments, dur > 0 ? dur : undefined);
      const uniqueWatched = Math.max(playTimeRef.current, calculateUniqueWatched(merged));
      playTimeRef.current = uniqueWatched;

      const uniquePct = dur > 0 ? Math.min(100, Math.round((uniqueWatched / dur) * 1000) / 10) : 0;
      const effectivePct = completedRef.current ? 100 : uniquePct;

      inFlightRef.current = true;
      try {
        console.log(
          `[VIDEO_PROGRESS] Syncing: lectureId=${lectureId} watchedSeconds=${uniqueWatched.toFixed(1)} percentage=${effectivePct}% lastPos=${current.toFixed(1)} finalize=${finalize}`
        );

        const response = await fetchApi<{
          completion_percentage: number;
          completed: boolean;
          active_screen_time_seconds: number;
          video_play_time_seconds: number;
          completion_threshold: number;
        }>(`/api/lectures/${lectureId}/progress`, {
          method: "POST",
          body: JSON.stringify({
            watched_seconds: uniqueWatched,
            completion_percentage: effectivePct,
            last_position_seconds: current,
            duration: dur > 0 ? dur : undefined,
            video_play_time_seconds: uniqueWatched,
            active_screen_time_seconds: activeTimeRef.current,
            segments: merged,
            last_activity_at: new Date().toISOString(),
          }),
        });

        if (typeof response.completion_threshold === "number" && response.completion_threshold > 0) {
          thresholdRef.current = response.completion_threshold;
        }

        const effectiveWatchPct = response.completed
          ? 100
          : Math.max(response.completion_percentage || 0, uniquePct);

        setWatchPercentage(effectiveWatchPct);
        onProgressUpdateRef.current?.(effectiveWatchPct, response.completed);

        // Completion ONLY happens when verified and confirmed by backend!
        if (response.completed && !completedRef.current) {
          console.log(`[LECTURE_COMPLETION] eligible=true confirmed by backend for lectureId=${lectureId}`);
          completedRef.current = true;
          setCompletedState(true);
          setWatchPercentage(100);
          onCompletedRef.current?.();
          if (onNextRef.current) setCountdown(3);
        }
      } catch (error) {
        console.warn("[VIDEO_ERROR] Failed to sync lecture progress:", error);
      } finally {
        inFlightRef.current = false;
      }
    },
    [lectureId],
  );

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const handlePlaybackEnded = useCallback(async () => {
    if (endHandledRef.current) return;
    endHandledRef.current = true;
    console.log(`[VIDEO_STATE] Playback genuinely ended for lectureId=${lectureId}`);
    try {
      await syncRef.current(true);
    } catch {}
  }, [lectureId]);

  useEffect(() => {
    handlePlaybackEndedRef.current = handlePlaybackEnded;
  }, [handlePlaybackEnded]);

  // YouTube IFrame Player (Lifecycle is isolated and stable)
  useEffect(() => {
    if (sourceType !== "youtube" || !resolvedId || !containerRef.current)
      return;

    console.log(`[VIDEO_INIT] lectureId=${lectureId} videoId=${resolvedId}`);

    let isDisposed = false;

    const createPlayer = () => {
      const youtube = window.YT;
      if (isDisposed || !containerRef.current || !youtube?.Player) return;

      if (playerRef.current && !(playerRef.current instanceof HTMLVideoElement)) {
        console.log(`[VIDEO_INIT] Player already exists for lectureId=${lectureId}, skipping recreation`);
        return;
      }

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
            if (isDisposed) return;
            const length = Number(event.target.getDuration?.() || 0);
            console.log(`[VIDEO_READY] duration=${length}`);
            if (length > 0) {
              durationRef.current = length;
              setDuration(length);
            }

            // Only seek to resume position ONCE, and NEVER seek to the end!
            if (!hasResumedRef.current) {
              hasResumedRef.current = true;
              const targetPos = initialPositionRef.current;
              if (
                targetPos > 0 &&
                (!length || targetPos < length - 3) &&
                !isCompletedRef.current
              ) {
                console.log(`[VIDEO_TIME] Resuming from saved position: currentTime=${targetPos} duration=${length}`);
                event.target.seekTo?.(targetPos, true);
              } else {
                console.log(`[VIDEO_TIME] Starting from position 0 (targetPos=${targetPos}, duration=${length})`);
              }
            }
          },
          onStateChange: (event: YouTubeEvent) => {
            if (isDisposed) return;
            const current = Number(
              event.target.getCurrentTime?.() || lastPositionRef.current,
            );
            const dur = Number(
              event.target.getDuration?.() || durationRef.current || 0,
            );
            lastPositionRef.current = current;

            const isPlayingNow = event.data === window.YT?.PlayerState.PLAYING;
            const isPaused = event.data === window.YT?.PlayerState.PAUSED;
            const isEnded = event.data === window.YT?.PlayerState.ENDED;
            const isBuffering = event.data === window.YT?.PlayerState.BUFFERING;

            const stateName = isPlayingNow
              ? "PLAYING"
              : isPaused
                ? "PAUSED"
                : isEnded
                  ? "ENDED"
                  : isBuffering
                    ? "BUFFERING"
                    : `STATE_${event.data}`;

            console.log(`[VIDEO_STATE] state=${stateName}`);
            console.log(`[VIDEO_TIME] currentTime=${current.toFixed(2)} duration=${dur.toFixed(2)}`);

            const wasPlaying = playingRef.current;
            playingRef.current = isPlayingNow;
            setIsPlaying(isPlayingNow);

            if (isPlayingNow) {
              endHandledRef.current = false;
              if (!wasPlaying) {
                currentSegmentStartRef.current = current;
                lastTickRef.current = Date.now();
              }
            } else if (wasPlaying) {
              // Closed segment on pause / buffering / end
              if (currentSegmentStartRef.current !== null) {
                const segStart = currentSegmentStartRef.current;
                if (current > segStart) {
                  watchedSegmentsRef.current.push([segStart, current]);
                }
                currentSegmentStartRef.current = null;
              }
              void syncRef.current(false);
            }

            if (isEnded) {
              void handlePlaybackEndedRef.current();
            }
          },
          onError: (event: { data: number }) => {
            console.warn(`[VIDEO_ERROR] YouTube player error code: ${event.data}`);
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const script =
        document.querySelector(
          "script[src='https://www.youtube.com/iframe_api']",
        ) || document.createElement("script");
      if (!script.parentNode) {
        script.setAttribute("src", "https://www.youtube.com/iframe_api");
        document.body.appendChild(script);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        createPlayer();
      };
    }

    return () => {
      isDisposed = true;
      const player = playerRef.current;
      if (player && !(player instanceof HTMLVideoElement)) {
        try {
          player.destroy?.();
        } catch {}
      }
      playerRef.current = null;
      hasResumedRef.current = false;
    };
  }, [resolvedId, sourceType, lectureId]);

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
        if (value.includes("end")) void handlePlaybackEndedRef.current();
        else void syncRef.current(false);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sourceType]);

  // High-accuracy 1-second progress tracking loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const lastTick = lastTickRef.current ?? now;
      const elapsed = Math.min(2, Math.max(0, (now - lastTick) / 1000));
      lastTickRef.current = now;

      const player = playerRef.current;
      const current =
        Number(getPlayerCurrentTime(player) ?? lastPositionRef.current) ||
        lastPositionRef.current;
      lastPositionRef.current = current;

      const isPlay = playingRef.current;
      const isTabActive = focused();

      if (isPlay) {
        if (isTabActive) {
          activeTimeRef.current += elapsed;
        }

        if (currentSegmentStartRef.current === null) {
          currentSegmentStartRef.current = current;
        }
      }

      // Calculate total unique watched seconds from segments
      const allSegments = [...watchedSegmentsRef.current];
      if (isPlay && currentSegmentStartRef.current !== null) {
        const segStart = currentSegmentStartRef.current;
        if (current > segStart) {
          allSegments.push([segStart, current]);
        }
      }

      const dur = Number(durationRef.current || getPlayerDuration(player) || 0);
      const merged = mergeSegments(allSegments, dur > 0 ? dur : undefined);
      const uniqueWatched = Math.max(playTimeRef.current, calculateUniqueWatched(merged));
      playTimeRef.current = uniqueWatched;

      if (dur > 0) {
        const uniquePct = Math.min(100, Math.round((uniqueWatched / dur) * 1000) / 10);
        if (!completedRef.current) {
          setWatchPercentage(uniquePct);
        }

        console.log(
          `[VIDEO_PROGRESS] watchedSeconds=${uniqueWatched.toFixed(1)} watchedPercentage=${uniquePct}% activeScreenTime=${activeTimeRef.current.toFixed(1)}`
        );

        // When requirements genuinely satisfied, trigger sync to complete
        const thresh = thresholdRef.current || 90;
        if (uniquePct >= thresh && !completedRef.current && !endHandledRef.current) {
          console.log(`[LECTURE_COMPLETION] eligible=true (uniquePct=${uniquePct}% >= thresh=${thresh}%)`);
          void syncRef.current(true);
        }
      }

      // Periodic sync every 5 seconds while playing
      if (isPlay && now % 5000 < 1100) {
        void syncRef.current(false);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Persist on visibility change, blur, and page exit
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      void syncRef.current(false);
    };

    const handleFocus = () => {
      lastTickRef.current = Date.now();
    };

    const handlePageExit = () => {
      void syncRef.current(false);
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
          <NextLecturePrompt
            countdown={countdown}
            onNext={onNext}
            hasNext={hasNext}
          />
        )}
        <LectureActionFooter
          watchPercentage={watchPercentage}
          threshold={completionThreshold}
          isCompleted={completedState || isCompleted}
          isGoogleDrive={true}
          hasNext={hasNext}
          onCompleteNext={async () => {
            await handlePlaybackEnded();
            onNext?.();
          }}
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
              const length = element.duration;
              console.log(`[VIDEO_READY] duration=${length}`);
              if (length > 0) {
                durationRef.current = length;
                setDuration(length);
              }
              if (!hasResumedRef.current) {
                hasResumedRef.current = true;
                const targetPos = initialPositionRef.current;
                if (targetPos > 0 && targetPos < length - 3 && !isCompletedRef.current) {
                  console.log(`[VIDEO_TIME] Local video resuming from: ${targetPos}`);
                  element.currentTime = targetPos;
                }
              }
            }}
            onPlay={(event) => {
              endHandledRef.current = false;
              playingRef.current = true;
              setIsPlaying(true);
              currentSegmentStartRef.current = event.currentTarget.currentTime;
              lastTickRef.current = Date.now();
              console.log(`[VIDEO_STATE] state=PLAYING`);
            }}
            onPlaying={() => {
              endHandledRef.current = false;
              playingRef.current = true;
              setIsPlaying(true);
            }}
            onPause={(event) => {
              playingRef.current = false;
              setIsPlaying(false);
              const current = event.currentTarget.currentTime;
              lastPositionRef.current = current;
              if (currentSegmentStartRef.current !== null) {
                const segStart = currentSegmentStartRef.current;
                if (current > segStart) {
                  watchedSegmentsRef.current.push([segStart, current]);
                }
                currentSegmentStartRef.current = null;
              }
              console.log(`[VIDEO_STATE] state=PAUSED`);
              void syncRef.current(false);
            }}
            onWaiting={() => {
              playingRef.current = false;
              setIsPlaying(false);
              console.log(`[VIDEO_STATE] state=BUFFERING`);
            }}
            onSeeking={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
            onSeeked={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
              const isPlay = !event.currentTarget.paused && !event.currentTarget.ended;
              playingRef.current = isPlay;
              setIsPlaying(isPlay);
            }}
            onEnded={(event) => {
              playingRef.current = false;
              setIsPlaying(false);
              lastPositionRef.current = event.currentTarget.currentTime;
              console.log(`[VIDEO_STATE] state=ENDED`);
              void handlePlaybackEndedRef.current();
            }}
            onTimeUpdate={(event) => {
              lastPositionRef.current = event.currentTarget.currentTime;
            }}
          />
        </div>
        <VideoProgressBar playing={isPlaying} progress={watchPercentage} />
        {countdown !== null && onNext && (
          <NextLecturePrompt
            countdown={countdown}
            onNext={onNext}
            hasNext={hasNext}
          />
        )}
        <LectureActionFooter
          watchPercentage={watchPercentage}
          threshold={completionThreshold}
          isCompleted={completedState || isCompleted}
          isGoogleDrive={false}
          hasNext={hasNext}
          onCompleteNext={async () => {
            await handlePlaybackEnded();
            onNext?.();
          }}
        />
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
        <NextLecturePrompt
          countdown={countdown}
          onNext={onNext}
          hasNext={hasNext}
        />
      )}
      <LectureActionFooter
        watchPercentage={watchPercentage}
        threshold={completionThreshold}
        isCompleted={completedState || isCompleted}
        isGoogleDrive={false}
        hasNext={hasNext}
        onCompleteNext={async () => {
          await handlePlaybackEnded();
          onNext?.();
        }}
      />
    </div>
  );
}

function LectureActionFooter({
  watchPercentage,
  threshold,
  isCompleted,
  isGoogleDrive,
  hasNext = true,
  onCompleteNext,
}: {
  watchPercentage: number;
  threshold: number;
  isCompleted: boolean;
  isGoogleDrive: boolean;
  hasNext?: boolean;
  onCompleteNext: () => void | Promise<void>;
}) {
  const eligible = isCompleted || watchPercentage >= threshold || isGoogleDrive;

  return (
    <div className="flex items-center justify-between pt-2 gap-3 flex-wrap border-t border-border-subtle/80 mt-1">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        {isCompleted || watchPercentage >= 100 ? (
          <span className="text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Lecture Completed (100%)
          </span>
        ) : (
          <span>Requirement: {threshold}% watched to unlock next</span>
        )}
      </div>

      {eligible && (
        <Button
          size="sm"
          onClick={onCompleteNext}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs"
        >
          {hasNext ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Proceed to Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <Award className="w-3.5 h-3.5" />
              <span>Generate & View Certificate</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function NextLecturePrompt({
  countdown,
  onNext,
  hasNext = true,
}: {
  countdown: number;
  onNext: () => void;
  hasNext?: boolean;
}) {
  const progress = Math.max(0, Math.min(100, (countdown / 3) * 100));

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-page-bg px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-text-secondary">
          {hasNext
            ? `Next lecture in ${countdown > 0 ? countdown : 1}s`
            : `All completed! Generating certificate in ${countdown > 0 ? countdown : 1}s`}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer"
        >
          {hasNext ? "Next" : "View Certificate"}
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-1000 ease-linear"
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
