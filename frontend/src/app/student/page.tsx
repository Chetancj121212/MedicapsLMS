"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Award,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

interface DashboardData {
  student: {
    full_name: string;
    enrollment_number: string;
    department: string;
    semester?: number;
    email?: string;
  };
  stats: {
    enrolled_courses: number;
    in_progress_courses: number;
    completed_courses: number;
    certificates_earned: number;
  };
  enrollments: Array<{
    id: number;
    course_id: number;
    course_title: string;
    course_code: string;
    instructor_name: string;
    status: string;
    progress_percentage: number;
    enrolled_at: string;
    completed_at?: string;
  }>;
}

export default function StudentDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/student");
      return;
    }
    if (!authLoading && user && user.role !== "STUDENT") {
      router.push("/admin");
      return;
    }

    async function loadDashboard() {
      try {
        const res = await fetchApi<DashboardData>("/api/student/dashboard");
        setData(res);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadDashboard();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const firstInProgress = data.enrollments.find((e) => e.status !== "COMPLETED") || data.enrollments[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ─── Restrained Academic Welcome Banner ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border-subtle border-l-4 border-l-primary p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            ECE Student Dashboard
          </div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-text-primary tracking-tight">
            Welcome back, {data.student.full_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-text-secondary">
            <span className="font-mono text-text-primary font-medium bg-[#F0F3F8] px-2 py-0.5 rounded">
              Enrollment No. {data.student.enrollment_number}
            </span>
            <span className="text-text-muted">&bull;</span>
            <span>{data.student.department}</span>
            {data.student.semester && (
              <>
                <span className="text-text-muted">&bull;</span>
                <span>Semester {data.student.semester}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {firstInProgress ? (
            <Link href={`/student/courses/${firstInProgress.course_id}/learn`}>
              <Button size="sm" className="gap-2">
                <span>Continue Learning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : (
            <Link href="/courses">
              <Button size="sm" className="gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Browse Courses</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ─── Statistics Grid: Single Consistent Visual Treatment ──────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border-subtle">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {String(data.stats.enrolled_courses).padStart(2, "0")}
              </div>
              <div className="text-xs font-medium text-text-secondary">Enrolled Courses</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {String(data.stats.in_progress_courses).padStart(2, "0")}
              </div>
              <div className="text-xs font-medium text-text-secondary">In Progress</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {String(data.stats.completed_courses).padStart(2, "0")}
              </div>
              <div className="text-xs font-medium text-text-secondary">Completed</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {String(data.stats.certificates_earned).padStart(2, "0")}
              </div>
              <div className="text-xs font-medium text-text-secondary">Certificates</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Enrolled Courses Section ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary">Enrolled Courses</h2>
            <p className="text-xs text-text-secondary">Track syllabus progress and resume lecture content.</p>
          </div>
          <span className="text-xs text-text-secondary font-medium">
            {data.enrollments.length} Course{data.enrollments.length === 1 ? "" : "s"}
          </span>
        </div>

        {data.enrollments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-border-subtle p-8 space-y-3">
            <GraduationCap className="w-10 h-10 text-text-muted mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">No courses currently enrolled</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Explore available courses from the Department of Electronics Engineering and register to start learning.
              </p>
            </div>
            <Link href="/courses">
              <Button size="sm" variant="outline">
                Browse Courses Catalog
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.enrollments.map((enr) => {
              const isCompleted = enr.status === "COMPLETED";
              const progressVal = Math.round(enr.progress_percentage);
              const progressStatus =
                progressVal === 0 ? "Not Started" : isCompleted ? "Completed" : "In Progress";

              return (
                <Card
                  key={enr.id}
                  className="flex flex-col justify-between border-border-subtle hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(40,56,135,0.06)] transition-all max-w-md w-full"
                >
                  <CardHeader className="space-y-2 pb-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md border border-primary/15">
                        {enr.course_code}
                      </span>
                      {isCompleted ? (
                        <Badge variant="success" className="gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Completed</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px]">
                          {progressStatus}
                        </Badge>
                      )}
                    </div>

                    <CardTitle className="text-[15px] font-semibold text-text-primary leading-snug line-clamp-2">
                      {enr.course_title}
                    </CardTitle>

                    <CardDescription className="text-xs text-text-secondary">
                      {enr.instructor_name ? `${enr.instructor_name} · ECE` : "Department of ECE"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2 py-2 px-5">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary font-medium">Course Progress</span>
                        <span className="font-semibold text-primary">{progressVal}%</span>
                      </div>
                      <Progress
                        value={enr.progress_percentage}
                        indicatorColor="bg-primary"
                      />
                      <div className="text-[11px] text-text-muted">{progressStatus}</div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 pb-4 px-5 border-t border-border-subtle flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">
                      Enrolled: {new Date(enr.enrolled_at).toLocaleDateString()}
                    </span>

                    <Link href={`/student/courses/${enr.course_id}/learn`}>
                      <Button
                        size="sm"
                        variant={isCompleted ? "outline" : "default"}
                        className="gap-1 text-xs h-8"
                      >
                        <span>{isCompleted ? "Review Course" : "Continue Learning"}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
