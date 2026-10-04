"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CourseDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  Video,
  FileQuestion,
  Award,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourse() {
      try {
        const data = await fetchApi<CourseDetail>(`/api/courses/${courseId}`);
        setCourse(data);
      } catch (err) {
        console.error("Failed to load course details:", err);
      } finally {
        setLoading(false);
      }
    }
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const handleEnrollOrStart = async () => {
    if (!user) {
      router.push(`/login?redirect=/courses/${courseId}`);
      return;
    }
    if (user.role !== "STUDENT") {
      router.push("/admin");
      return;
    }

    setEnrolling(true);
    setEnrollError(null);
    try {
      await fetchApi(`/api/courses/${courseId}/enroll`, { method: "POST" });
      router.push(`/student/courses/${courseId}/learn`);
    } catch (err) {
      setEnrollError(
        err instanceof Error ? err.message : "Unable to enroll in this course",
      );
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <CourseCardSkeleton />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <h3 className="text-base font-semibold text-text-primary">
          Course Not Found
        </h3>
        <p className="text-xs text-text-secondary">
          The requested course curriculum does not exist.
        </p>
        <Link href="/courses">
          <Button size="sm">Browse Courses</Button>
        </Link>
      </div>
    );
  }

  const totalLectures =
    course.modules?.reduce((acc, m) => acc + (m.lectures?.length || 0), 0) || 0;
  const totalQuizzes =
    course.modules?.reduce((acc, m) => acc + (m.quizzes?.length || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/courses"
          className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Course Banner */}
      <div className="bg-primary-dark text-white rounded-xl p-6 sm:p-8 border border-primary-secondary/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-white bg-white/15 px-2 py-0.5 rounded">
              {course.course_code}
            </span>
            <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded text-slate-200 font-medium">
              ECE Academic Module
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            {course.title}
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            {course.short_description}
          </p>

          <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-slate-300">
            {course.instructor_name && (
              <div className="flex items-center gap-1.5 font-medium text-white">
                <GraduationCap className="w-4 h-4 text-primary-steel" />
                <span>{course.instructor_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary-steel" />
              <span>{course.estimated_duration || "Self-Paced"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Verified Certificate</span>
            </div>
          </div>
        </div>

        {/* Enroll Action Box */}
        <div className="bg-white text-text-primary rounded-xl p-5 border border-border-subtle shadow-sm w-full md:w-72 shrink-0 space-y-3">
          <div className="text-center pb-2 border-b border-border-subtle">
            <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">
              Access Status
            </div>
            <div className="text-base font-semibold text-text-primary mt-0.5">
              Free for ECE Students
            </div>
          </div>

          <Button
            size="md"
            onClick={handleEnrollOrStart}
            isLoading={enrolling}
            className="w-full gap-1.5 h-10 text-xs font-medium"
          >
            <span>{user ? "Start Learning" : "Login to Enroll"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>

          {enrollError && (
            <p className="text-xs text-primary" role="alert">
              {enrollError}
            </p>
          )}

          <div className="space-y-1.5 text-xs text-text-secondary pt-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {course.modules?.length || 0} Modules with structured pacing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {totalLectures} Video Lectures & {totalQuizzes} Assessments
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Verifiable digital certificate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Syllabus & Description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Course Overview */}
          <div className="bg-white rounded-xl border border-border-subtle p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <h2 className="text-base font-semibold text-text-primary border-b border-border-subtle pb-2">
              About This Course
            </h2>
            <div className="text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {course.description || course.short_description}
            </div>
          </div>

          {/* Curriculum Breakdown */}
          <div className="bg-white rounded-xl border border-border-subtle p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <h2 className="text-base font-semibold text-text-primary">
                Course Curriculum & Syllabus
              </h2>
              <span className="text-xs text-text-secondary font-medium">
                {course.modules?.length || 0} Modules &bull; {totalLectures}{" "}
                Lectures
              </span>
            </div>

            <div className="space-y-3">
              {course.modules?.map((mod, idx) => (
                <div
                  key={mod.id}
                  className="border border-border-subtle rounded-lg overflow-hidden"
                >
                  <div className="bg-[#F7F8FA] px-3.5 py-2.5 border-b border-border-subtle flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                        Module {idx + 1}
                      </div>
                      <div className="text-xs font-semibold text-text-primary">
                        {mod.title}
                      </div>
                    </div>
                    <span className="text-[11px] text-text-secondary">
                      {mod.lectures?.length || 0} lectures &bull;{" "}
                      {mod.quizzes?.length || 0} quiz
                    </span>
                  </div>

                  <div className="divide-y divide-border-subtle p-1">
                    {mod.lectures?.map((lec) => (
                      <div
                        key={lec.id}
                        className="px-3 py-2 flex items-center justify-between text-xs text-text-primary"
                      >
                        <div className="flex items-center gap-2">
                          <Video className="w-3.5 h-3.5 text-text-muted" />
                          <span>{lec.title}</span>
                        </div>
                        <span className="text-text-muted font-mono text-[11px]">
                          Video Lecture
                        </span>
                      </div>
                    ))}
                    {mod.quizzes?.map((qz) => (
                      <div
                        key={qz.id}
                        className="px-3 py-2 flex items-center justify-between text-xs text-text-primary bg-[#F7F8FA]"
                      >
                        <div className="flex items-center gap-2">
                          <FileQuestion className="w-3.5 h-3.5 text-primary" />
                          <span className="font-medium">{qz.title}</span>
                        </div>
                        <span className="text-primary font-mono text-[11px]">
                          Quiz ({qz.passing_percentage}% Required)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Requirements & Certificate Specs */}
        <div className="space-y-5">
          <Card className="border-border-subtle">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <span>Certificate Criteria</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-text-secondary p-5 pt-1">
              <p>
                Per Department of Electronics Engineering regulations,
                certificates are automatically generated upon fulfilling:
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-text-primary">
                <li>Completing all video lectures (90%+ watched)</li>
                <li>Passing all module quizzes at required score</li>
                <li>Passing the final comprehensive assessment</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <div>
                  <div className="font-semibold text-xs text-text-primary">
                    QR Verifiable
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    Includes secure link to public verification record.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
