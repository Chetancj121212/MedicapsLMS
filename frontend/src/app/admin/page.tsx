"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BookOpen,
  Users,
  Award,
  CheckCircle2,
  PlusCircle,
  ChevronRight,
} from "lucide-react";

interface AdminDashboardData {
  total_students: number;
  total_courses: number;
  published_courses: number;
  certificates_issued: number;
  recent_activities: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin");
      return;
    }
    if (!authLoading && user && user.role === "STUDENT") {
      router.push("/student");
      return;
    }

    async function load() {
      try {
        const res = await fetchApi<AdminDashboardData>("/api/admin/dashboard");
        setData(res);
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    if (user && user.role !== "STUDENT") {
      load();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* ─── Top Admin Bar ────────────────────────────────────────────────────── */}
      <div className="bg-[#142250] text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <span>Department Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            ECE Faculty & Admin Portal
          </h1>
          <p className="text-xs text-slate-300">
            Medicaps University &bull; Manage courses, student rosters, video
            uploads, and credentials.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link href="/admin/courses">
            <Button size="sm" variant="accent" className="gap-1.5 shadow-xs">
              <PlusCircle className="w-4 h-4" />
              <span>Create / Build Course</span>
            </Button>
          </Link>

          <Link href="/admin/students">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/25 gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Manage Students</span>
            </Button>
          </Link>

          {(user?.role === "MASTER_ADMIN" || user?.role === "SUPER_ADMIN") && (
            <Link href="/addadmins">
              <Button size="sm" variant="outline" className="gap-1.5">
                <span>Manage Admins</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ─── Statistics Grid (Section 27) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border-subtle">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {data.total_students}
              </div>
              <div className="text-xs font-medium text-text-secondary">
                Total Students
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {data.total_courses}
              </div>
              <div className="text-xs font-medium text-text-secondary">
                Total Courses
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {data.published_courses}
              </div>
              <div className="text-xs font-medium text-text-secondary">
                Published Courses
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-subtle">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/8 text-primary flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {data.certificates_issued}
              </div>
              <div className="text-xs font-medium text-text-secondary">
                Certificates Issued
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Admin Quick Navigation & Recent Activities ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Management Shortcuts */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Administrative Tools
          </h2>

          <div className="space-y-3">
            <Link href="/admin/courses" className="block">
              <Card className="p-4 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/8 text-primary flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Course Builder
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Upload lectures & create quizzes
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Card>
            </Link>

            <Link href="/admin/students" className="block">
              <Card className="p-4 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/8 text-primary flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Student Directory & CSV
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Manage enrollment numbers & progress
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Card>
            </Link>

            <Link href="/admin/certificates" className="block">
              <Card className="p-4 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/8 text-primary flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Certificate Registry
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Verify authenticity & handle revocation
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed (Section 27) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Recent Platform Activity
            </h2>
            <span className="text-xs text-text-muted">Live logs</span>
          </div>

          <Card className="border-border-subtle divide-y divide-border-subtle">
            {data.recent_activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No recent activity recorded yet.
              </div>
            ) : (
              data.recent_activities.map((act, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-medium text-text-primary">
                      {act.message}
                    </span>
                  </div>
                  <span className="text-text-muted font-mono text-[11px] shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
