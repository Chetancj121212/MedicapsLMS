"use client";

import React, { useEffect, useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { CourseCurriculumSkeleton } from "@/components/ui/Skeleton";
import {
  Play,
  Lock,
  CheckCircle2,
  FileQuestion,
  Award,
  ChevronRight,
  Download,
  ShieldCheck,
  ArrowLeft,
  Circle,
} from "lucide-react";

export default function CourseLearningPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const courseId = params?.courseId as string;

  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculumStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CurriculumItemStatus | null>(
    null,
  );

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

      // Check if course just completed
      if (
        curriculumData.enrollment.status === "COMPLETED" &&
        curriculumData.certificate
      ) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
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
    if (user && courseId) {
      loadStatus();
    }
  }, [user, authLoading, courseId, loadStatus, router]);

  const handleLectureCompleted = async () => {
    await loadStatus();
  };

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

  const selectContentItem = (item: CurriculumItemStatus) => {
    if (item.is_locked) return;
    if (item.type === "quiz") {
      router.push(`/student/courses/${courseId}/quiz/${item.id}`);
    } else {
      setSelectedItem(item);
    }
  };

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
  const progressPct = Math.round(curriculum.enrollment.progress_percentage);
  const courseTitle = courseDetail?.title || "Introduction to Embedded Systems";
  const courseCode = courseDetail?.course_code || "ECE-301";

  // Find module containing the selected item
  const activeModule = curriculum.modules.find((m) =>
    m.items.some(
      (it) => it.id === selectedItem?.id && it.type === selectedItem?.type,
    ),
  );
  const activeModuleIdx = activeModule
    ? curriculum.modules.indexOf(activeModule) + 1
    : 1;
  const lectureWatchedPct = selectedItem?.is_completed
    ? 100
    : Math.round(selectedItem?.progress?.completion_percentage || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── Course Header Sub-bar: Clean Academic Identification ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/student"
              className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Dashboard</span>
            </Link>
            <span className="text-border-subtle">/</span>
            <span className="text-xs font-mono font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded">
              {courseCode}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <span>{courseTitle}</span>
            {isCourseCompleted && (
              <Badge variant="success" className="gap-1 text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>Completed</span>
              </Badge>
            )}
          </h1>
        </div>

        {/* Progress & Certificate Action */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="space-y-1 text-right min-w-[140px]">
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary font-medium">Your Progress</span>
              <span className="font-semibold text-primary">
                {progressPct}%
              </span>
            </div>
            <Progress
              value={curriculum.enrollment.progress_percentage}
              indicatorColor="bg-primary"
              className="w-36 sm:w-44 h-1.5"
            />
          </div>

          {/* Download Certificate: ONLY visible upon course completion */}
          {isCourseCompleted && curriculum.certificate ? (
            <a
              href={getCertificateDownloadUrl(
                curriculum.certificate.certificate_number,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" className="gap-1.5 h-8 text-xs shadow-xs">
                <Award className="w-3.5 h-3.5" />
                <span>Download Certificate</span>
              </Button>
            </a>
          ) : curriculum.eligibility && !curriculum.eligibility.eligible ? (
            <div
              className="hidden md:flex items-center gap-1.5 text-[11px] text-text-muted border border-border-subtle px-2.5 py-1.5 rounded-md bg-[#F7F8FA] cursor-help"
              title={curriculum.eligibility.missing_requirements.join('\n') || 'Complete all requirements'}
            >
              <Award className="w-3.5 h-3.5 text-text-muted" />
              <span>
                {curriculum.eligibility.lectures.remaining > 0
                  ? `${curriculum.eligibility.lectures.remaining} lecture${curriculum.eligibility.lectures.remaining > 1 ? 's' : ''} remaining`
                  : curriculum.eligibility.module_quizzes.remaining > 0
                  ? `${curriculum.eligibility.module_quizzes.remaining} quiz${curriculum.eligibility.module_quizzes.remaining > 1 ? 'zes' : ''} remaining`
                  : curriculum.eligibility.final_assessment.remaining > 0
                  ? 'Final assessment required'
                  : 'Certificate on completion'}
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-text-muted border border-border-subtle px-2.5 py-1.5 rounded-md bg-[#F7F8FA]">
              <Award className="w-3.5 h-3.5 text-text-muted" />
              <span>Certificate on completion</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main 70/30 Learning Layout (Dominant Video + Clean Curriculum) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dominant Video & Lecture Info Area (~70% = 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-border-subtle p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            {selectedItem?.type === "lecture" ? (
              <VideoPlayer
                key={selectedItem.id}
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
                onProgressUpdate={handleProgressUpdate}
              />
            ) : selectedItem?.type === "quiz" ? (
              <div className="py-16 text-center space-y-4 bg-[#F7F8FA] rounded-xl border border-border-subtle p-8">
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
              <div className="aspect-video bg-[#F7F8FA] rounded-xl border border-border-subtle flex flex-col items-center justify-center p-8 text-center space-y-3">
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

                {/* Subtle Lecture Progress Indicator */}
                <div className="pt-2 space-y-1.5 max-w-sm">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">
                      Lecture Progress
                    </span>
                    <span className="font-semibold text-primary">
                      {lectureWatchedPct}%
                    </span>
                  </div>
                  <Progress
                    value={lectureWatchedPct}
                    indicatorColor="bg-primary"
                    className="h-1.5"
                  />
                  <div className="text-[11px] text-text-muted">
                    {selectedItem.is_completed
                      ? "Completed — next items unlocked."
                      : `Watch at least ${selectedItem.completion_threshold ?? 90}% and maintain 60% active screen time to unlock the next lecture.`}
                  </div>
                </div>
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
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ─── Curriculum Sidebar (~30% = 4 cols) ─────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-subtle bg-[#F7F8FA] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Course Content
                </h3>
                <div className="text-[11px] text-text-secondary">
                  {curriculum.completed_lectures} of {curriculum.total_lectures}{" "}
                  Lectures Completed
                </div>
              </div>
            </div>

            {/* Module Hierarchy */}
            <div className="divide-y divide-border-subtle max-h-[620px] overflow-y-auto">
              {curriculum.modules.map((mod, modIdx) => (
                <div key={mod.id} className="p-3.5 space-y-2">
                  <div>
                    <div className="text-[10px] font-semibold tracking-wider text-text-secondary uppercase">
                      MODULE {String(modIdx + 1).padStart(2, "0")}
                    </div>
                    <div className="text-xs font-semibold text-text-primary">
                      {mod.title}
                    </div>
                  </div>

                  {/* Module Items: Clean typography, indentation, no heavy button boxes */}
                  <div className="space-y-0.5 pl-1.5">
                    {mod.items.map((it) => {
                      const isSelected =
                        selectedItem?.id === it.id &&
                        selectedItem?.type === it.type;

                      return (
                        <button
                          key={`${it.type}-${it.id}`}
                          onClick={() => selectContentItem(it)}
                          disabled={it.is_locked}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-primary/10 text-primary font-semibold"
                              : it.is_locked
                                ? "text-text-secondary cursor-not-allowed opacity-80"
                                : it.is_completed
                                  ? "text-text-primary hover:bg-[#F0F3F8] cursor-pointer"
                                  : "text-text-primary hover:bg-[#F0F3F8] cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {it.is_completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : it.is_locked ? (
                              <Lock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            ) : it.type === "quiz" ? (
                              <FileQuestion className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            <span className="truncate">{it.title}</span>
                          </div>

                          <div className="shrink-0 text-[10px]">
                            {it.is_locked ? (
                              <span className="text-text-muted font-mono">
                                Locked
                              </span>
                            ) : it.is_completed ? (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                100%
                              </span>
                            ) : it.type === "quiz" ? (
                              <span className="text-primary font-medium">
                                Quiz
                              </span>
                            ) : it.progress &&
                              it.progress.completion_percentage > 0 ? (
                              <span className="text-text-secondary font-mono">
                                {Math.round(it.progress.completion_percentage)}%
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Final Assessments */}
              {curriculum.final_quizzes?.length > 0 && (
                <div className="p-3.5 space-y-2 bg-[#F7F8FA]">
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
