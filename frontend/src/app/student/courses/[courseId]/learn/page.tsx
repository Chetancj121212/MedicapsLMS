"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { fetchApi, getCertificateDownloadUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CourseCurriculumStatus,
  CurriculumItemStatus,
  CourseDetail,
} from "@/types";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { CourseCurriculumSkeleton } from "@/components/ui/Skeleton";
import {
  Play,
  Lock,
  CheckCircle2,
  FileQuestion,
  Award,
  ChevronRight,
  Download,
  ArrowLeft,
  LogOut,
} from "lucide-react";

export default function CourseLearningPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const courseId = params?.courseId as string;

  const [, setCourseDetail] = useState<CourseDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculumStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CurriculumItemStatus | null>(
    null,
  );
  const [playbackVersion, setPlaybackVersion] = useState(0);
  const completionCelebratedRef = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const [curriculumData, detailData] = await Promise.all([
        fetchApi<CourseCurriculumStatus>(`/api/courses/${courseId}/learn`),
        fetchApi<CourseDetail>(`/api/courses/${courseId}`).catch(() => null),
      ]);

      setCurriculum(curriculumData);
      if (detailData) {
        setCourseDetail(detailData);
      }

      // Sync selectedItem with fresh curriculumData
      setSelectedItem((prev) => {
        if (prev) {
          for (const mod of curriculumData.modules) {
            const found = mod.items.find(
              (it) => it.id === prev.id && it.type === prev.type,
            );
            if (found) return found;
          }
          if (curriculumData.final_quizzes) {
            const found = curriculumData.final_quizzes.find(
              (fq) => fq.id === prev.id,
            );
            if (found) return found;
          }
          return prev;
        }

        let firstPlayable: CurriculumItemStatus | null = null;
        for (const mod of curriculumData.modules) {
          for (const it of mod.items) {
            if (!it.is_locked && !firstPlayable) {
              firstPlayable = it;
            }
            if (!it.is_locked && !it.is_completed) {
              firstPlayable = it;
              break;
            }
          }
          if (firstPlayable && !firstPlayable.is_completed) break;
        }
        return firstPlayable;
      });

      // Celebrate once when the certificate becomes available.
      if (
        curriculumData.enrollment.status === "COMPLETED" &&
        curriculumData.certificate &&
        !completionCelebratedRef.current
      ) {
        completionCelebratedRef.current = true;
        confetti({
          particleCount: 140,
          spread: 80,
          startVelocity: 35,
          origin: { x: 0.2, y: 0.65 },
        });
        window.setTimeout(() => {
          confetti({
            particleCount: 160,
            spread: 100,
            startVelocity: 30,
            origin: { x: 0.8, y: 0.65 },
          });
        }, 220);
        window.setTimeout(() => {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { x: 0.5, y: 0.45 },
          });
        }, 480);
      }
      if (curriculumData.enrollment.status !== "COMPLETED") {
        completionCelebratedRef.current = false;
      }
    } catch (err) {
      console.error("Failed to load learning path:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/student/courses/${courseId}/learn`);
      return;
    }
    if (user && user.role !== "STUDENT") {
      router.push("/admin");
      return;
    }
    if (user && courseId) {
      // Loading the course status after auth is confirmed is intentional; the
      // async fetch updates state in the callback, not synchronously in the effect body.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStatus();
    }
  }, [user, authLoading, courseId, loadStatus, router]);

  const handleLectureCompleted = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  // Realtime progress updater from VideoPlayer
  const handleProgressUpdate = useCallback(
    (percentage: number, isCompleted: boolean) => {
      setSelectedItem((prev) => {
        if (!prev) return prev;
        const currentPct = prev.progress?.completion_percentage || 0;
        const effectivePct = isCompleted
          ? 100
          : Math.max(percentage, currentPct);
        return {
          ...prev,
          is_completed: isCompleted || prev.is_completed,
          progress: prev.progress
            ? {
                ...prev.progress,
                completion_percentage: effectivePct,
              }
            : {
                watched_seconds: 0,
                last_position_seconds: 0,
                completion_percentage: effectivePct,
              },
        };
      });

      if (isCompleted) {
        setCurriculum((prevCurriculum) => {
          if (!prevCurriculum) return prevCurriculum;

          let newlyCompletedCount = 0;
          let prevItemCompleted = true;

          const updatedModules = prevCurriculum.modules.map((mod) => {
            let allLecturesCompleted = true;
            let allQuizzesPassed = true;

            const updatedItems = mod.items.map((it) => {
              let itemCompleted = it.is_completed;
              let itemProg = it.progress;

              if (it.type === "lecture" && it.id === selectedItem?.id) {
                itemCompleted = true;
                itemProg = {
                  watched_seconds: it.progress?.watched_seconds || 0,
                  last_position_seconds:
                    it.progress?.last_position_seconds || 0,
                  completion_percentage: 100,
                };
              }

              if (itemCompleted) {
                newlyCompletedCount++;
              } else {
                if (it.type === "lecture") allLecturesCompleted = false;
                if (it.type === "quiz") allQuizzesPassed = false;
              }

              const isLocked = !prevItemCompleted;
              prevItemCompleted = itemCompleted;

              return {
                ...it,
                is_completed: itemCompleted,
                is_locked: isLocked,
                progress: itemProg,
              };
            });

            return {
              ...mod,
              is_completed: allLecturesCompleted && allQuizzesPassed,
              items: updatedItems,
            };
          });

          const totalLec = prevCurriculum.total_lectures || 1;
          const calcProgress = Math.min(
            100,
            Math.round((newlyCompletedCount / totalLec) * 100),
          );

          return {
            ...prevCurriculum,
            completed_lectures: Math.max(
              prevCurriculum.completed_lectures,
              newlyCompletedCount,
            ),
            enrollment: {
              ...prevCurriculum.enrollment,
              progress_percentage: Math.max(
                prevCurriculum.enrollment.progress_percentage,
                calcProgress,
              ),
              status:
                calcProgress >= 100
                  ? "COMPLETED"
                  : prevCurriculum.enrollment.status,
            },
            modules: updatedModules,
          };
        });
      }
    },
    [selectedItem?.id],
  );

  const selectContentItem = useCallback(
    (item: CurriculumItemStatus) => {
      if (item.is_locked) return;
      if (item.type === "quiz") {
        router.push(`/student/courses/${courseId}/quiz/${item.id}`);
      } else {
        setSelectedItem(item);
        setPlaybackVersion((version) => version + 1);
      }
    },
    [courseId, router],
  );

  const handleNextItem = useCallback(() => {
    if (!curriculum || !selectedItem) return;

    const items = [
      ...curriculum.modules.flatMap((module) => module.items),
      ...(curriculum.final_quizzes || []),
    ];
    const currentIndex = items.findIndex(
      (item) => item.id === selectedItem.id && item.type === selectedItem.type,
    );
    const nextItem = items
      .slice(currentIndex + 1)
      .find((item) => !item.is_locked);

    if (nextItem) selectContentItem(nextItem);
  }, [curriculum, selectContentItem, selectedItem]);

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/student")}
            className="h-8 text-xs text-text-secondary"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Dashboard
          </Button>
        </div>
        <CourseCurriculumSkeleton />
      </div>
    );
  }

  if (!curriculum) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
          Enrollment Required
        </h3>
        <p className="text-xs text-text-secondary">
          Please enroll in this course first to access lectures.
        </p>
        <Link href={`/courses/${courseId}`}>
          <Button size="sm">View Course Overview</Button>
        </Link>
      </div>
    );
  }

  const isCourseCompleted = curriculum.enrollment.status === "COMPLETED";

  // Find module containing the selected item
  const activeModule = curriculum.modules.find((m) =>
    m.items.some(
      (it) => it.id === selectedItem?.id && it.type === selectedItem?.type,
    ),
  );
  const activeModuleIdx = activeModule
    ? curriculum.modules.indexOf(activeModule) + 1
    : 1;

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── Main 80/20 Learning Layout (Expanded Video + Curriculum Rail) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(300px,1fr)] gap-4 items-start">
        {/* Dominant Video & Lecture Info Area (80% when space allows) */}
        <div className="min-w-0 space-y-4 lg:-translate-x-6 lg:-translate-y-4">
          <div className="bg-white rounded-xl border border-border-subtle p-2 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            {selectedItem?.type === "lecture" ? (
              <VideoPlayer
                key={`${selectedItem.id}-${playbackVersion}`}
                lectureId={selectedItem.id}
                videoUrl={
                  selectedItem.video_source_url ||
                  selectedItem.video_path?.startsWith("http")
                    ? selectedItem.video_source_url ||
                      selectedItem.video_path ||
                      ""
                    : `http://localhost:8000${selectedItem.video_path || "/uploads/videos/sample.mp4"}`
                }
                videoSourceType={selectedItem.video_source_type}
                videoId={selectedItem.video_id}
                completionThreshold={selectedItem.completion_threshold}
                duration={selectedItem.duration}
                initialPosition={
                  selectedItem.progress?.last_position_seconds || 0
                }
                initialPercentage={
                  selectedItem.is_completed
                    ? 100
                    : selectedItem.progress?.completion_percentage || 0
                }
                initialActiveScreenTime={
                  selectedItem.progress?.active_screen_time_seconds || 0
                }
                initialVideoPlayTime={
                  selectedItem.progress?.video_play_time_seconds ||
                  selectedItem.progress?.watched_seconds ||
                  0
                }
                isCompleted={selectedItem.is_completed}
                onCompleted={handleLectureCompleted}
                onNext={handleNextItem}
                onProgressUpdate={handleProgressUpdate}
              />
            ) : selectedItem?.type === "quiz" ? (
              <div className="py-16 text-center space-y-4 bg-page-bg rounded-xl border border-border-subtle p-8">
                <FileQuestion className="w-10 h-10 text-primary mx-auto" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {selectedItem.title}
                  </h2>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Module evaluation requiring{" "}
                    {selectedItem.passing_percentage}% score to complete this
                    milestone and unlock subsequent content.
                  </p>
                </div>
                <Link
                  href={`/student/courses/${courseId}/quiz/${selectedItem.id}`}
                >
                  <Button size="sm" className="gap-1.5">
                    <span>Start Assessment</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              /* Intentional Clean Video Placeholder per Section 13 */
              <div className="aspect-video bg-page-bg rounded-xl border border-border-subtle flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/8 text-primary flex items-center justify-center">
                  <Play className="w-5 h-5 ml-0.5 fill-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Video Preview
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Select a lecture from the curriculum to begin learning.
                  </p>
                </div>
              </div>
            )}

            {/* Lecture Information Area Below Video */}
            {selectedItem?.type === "lecture" && (
              <div className="pt-2 space-y-3 border-t border-border-subtle">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    MODULE {String(activeModuleIdx).padStart(2, "0")} ·{" "}
                    {activeModule?.title || "COURSE CURRICULUM"}
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-text-primary">
                    {selectedItem.title}
                  </h2>
                </div>

                <p className="text-xs sm:text-[13px] text-text-secondary leading-relaxed">
                  Academic instructional module prepared for the Department of
                  Electronics Engineering. Progress is recorded continuously as
                  you engage with the syllabus content.
                </p>
              </div>
            )}
          </div>

          {/* Certificate Completion Card (shown only upon completion) */}
          {isCourseCompleted && curriculum.certificate && (
            <div className="rounded-xl bg-white border border-border-subtle p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Course Completed
                </div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Academic Certificate Issued
                </h3>
                <p className="text-[11px] text-text-secondary font-mono">
                  Certificate No: {curriculum.certificate.certificate_number}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <a
                  href={getCertificateDownloadUrl(
                    curriculum.certificate.certificate_number,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="gap-1.5 text-xs h-8">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </Button>
                </a>

                <Link
                  href={`/verify/${curriculum.certificate.certificate_number}`}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8 text-primary border-border-subtle"
                  >
                    <span>Verify</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ─── Curriculum Sidebar (minimum 300px) ───────────────────────────── */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start lg:-translate-x-8 lg:-translate-y-4 lg:w-[calc(100%+3rem)]">
          <div className="bg-white rounded-xl border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-subtle bg-page-bg flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Course Content
                </h3>
                <div className="text-[11px] text-text-secondary">
                  {curriculum.completed_lectures} of {curriculum.total_lectures}{" "}
                  Lectures Completed
                </div>
              </div>
              <Link href="/student" className="shrink-0">
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 bg-primary-dark hover:bg-primary-dark/90"
                  title="Exit course"
                  aria-label="Exit course"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* Module Hierarchy */}
            <div className="divide-y divide-border-subtle max-h-155 overflow-y-auto">
              {curriculum.modules.map((mod, modIdx) => (
                <div key={mod.id} className="p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-semibold tracking-wider text-text-secondary uppercase">
                        MODULE {String(modIdx + 1).padStart(2, "0")}
                      </div>
                      <div className="text-xs font-semibold text-text-primary">
                        {mod.title}
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-text-secondary">
                      {mod.items.filter((it) => it.is_completed).length}/
                      {mod.items.length}
                    </span>
                  </div>

                  <div className="relative space-y-1 pl-5">
                    <div className="absolute bottom-2 left-1 top-2 w-0.5 bg-slate-200" />
                    {mod.items.map((it) => {
                      const isSelected =
                        selectedItem?.id === it.id &&
                        selectedItem?.type === it.type;
                      const isLocked = it.is_locked;

                      return (
                        <div key={`${it.type}-${it.id}`} className="relative">
                          <span
                            className={`absolute -left-5 top-3 h-2.5 w-2.5 rounded-full border ${
                              it.is_completed
                                ? "border-primary bg-primary"
                                : "border-slate-200 bg-slate-100"
                            }`}
                          />
                          <button
                            onClick={() => selectContentItem(it)}
                            disabled={isLocked}
                            className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-all ${
                              isSelected
                                ? "bg-primary/8 text-primary font-semibold shadow-[inset_0_0_0_1px_rgba(42,82,186,0.08)]"
                                : isLocked
                                  ? "cursor-not-allowed text-text-secondary opacity-80"
                                  : "cursor-pointer text-text-primary hover:bg-[#F4F6F8]"
                            }`}
                          >
                            <span className="block truncate">{it.title}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Final Assessments */}
              {curriculum.final_quizzes?.length > 0 && (
                <div className="p-3.5 space-y-2 bg-page-bg">
                  <div>
                    <div className="text-[10px] font-semibold tracking-wider text-primary uppercase">
                      FINAL ASSESSMENT
                    </div>
                    <div className="text-xs font-semibold text-text-primary">
                      Comprehensive Course Examination
                    </div>
                  </div>

                  <div className="space-y-0.5 pl-1.5">
                    {curriculum.final_quizzes.map((fq) => (
                      <button
                        key={`final-${fq.id}`}
                        onClick={() => selectContentItem(fq)}
                        disabled={fq.is_locked}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                          fq.is_locked
                            ? "text-text-secondary cursor-not-allowed opacity-80"
                            : fq.is_completed
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-text-primary hover:bg-[#F0F3F8] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {fq.is_completed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : fq.is_locked ? (
                            <Lock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          ) : (
                            <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                          <span className="truncate">{fq.title}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-text-muted">
                          {fq.is_locked
                            ? "Locked"
                            : fq.is_completed
                              ? "Passed"
                              : "Required"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
