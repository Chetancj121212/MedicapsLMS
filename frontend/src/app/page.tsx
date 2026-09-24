"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { CourseListItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import { CourseCard } from "@/components/course/CourseCard";
import {
  BookOpen,
  GraduationCap,
  Award,
  Video,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Layers,
} from "lucide-react";

export default function HomePage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCourses() {
      try {
        const data = await fetchApi<CourseListItem[]>("/api/courses");
        setCourses(data);
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, []);

  return (
    <div className="space-y-14 pb-16">
      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-dark text-white pt-14 pb-16 px-4 sm:px-6 lg:px-8 border-b border-primary-secondary/40">
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 text-slate-200 text-xs font-medium backdrop-blur-xs border border-white/10">
            <GraduationCap className="w-4 h-4 text-primary-steel" />
            <span>Department of Electronics Engineering</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
            Rigorous Academic Modules.{" "}
            <span className="text-primary-steel">Verifiable Mastery.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            The Department of Electronics Engineering at Medicaps University
            provides structured online academic curriculum featuring high-yield
            video lectures, sequential unlocks, mastery assessments, and
            cryptographically verified digital certification.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="#courses">
              <Button
                size="md"
                className="gap-2 bg-primary hover:bg-primary-dark text-white"
              >
                <BookOpen className="w-4 h-4" />
                <span>Explore Courses</span>
              </Button>
            </Link>

            <Link href="/login">
              <Button
                size="md"
                variant="outline"
                className="border-white/30 bg-white/5 hover:bg-white/15 text-white gap-2"
              >
                <span>Student Login</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Academic Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 max-w-3xl mx-auto border-t border-white/10 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary-steel shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Curated Lectures
                </div>
                <div className="text-[11px] text-slate-300">
                  Targeted video content
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary-steel shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Sequential Unlock
                </div>
                <div className="text-[11px] text-slate-300">
                  Mastery before advancement
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary-steel shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Direct Assessments
                </div>
                <div className="text-[11px] text-slate-300">
                  Server-validated quizzes
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary-steel shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Verifiable Records
                </div>
                <div className="text-[11px] text-slate-300">
                  Tamper-evident certificates
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Published Courses Section ────────────────────────────────────────── */}
      <section id="courses" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-0.5">
              Curriculum Offerings
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
              Department Online Courses
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Enroll in self-paced academic courses developed by ECE faculty.
            </p>
          </div>
          <div className="text-xs text-text-secondary">
            Showing{" "}
            <span className="font-semibold text-text-primary">
              {courses.length}
            </span>{" "}
            published course{courses.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-border-subtle p-8 space-y-3">
            <Cpu className="w-10 h-10 text-text-muted mx-auto" />
            <h3 className="text-sm font-semibold text-text-primary">
              No courses currently available
            </h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              The ECE department is currently preparing new curriculum
              materials. Please check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Verification Callout Section ────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-xl bg-white text-text-primary p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-5 border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="space-y-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Verifiable Credential</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">
              Verify an ECE Academic Certificate
            </h3>
            <p className="text-xs text-text-secondary max-w-lg">
              Authenticate digital certificates issued by Medicaps University
              ECE Department using the unique Certificate ID.
            </p>
          </div>

          <Link href="/verify" className="shrink-0">
            <Button size="sm" className="gap-1.5 h-9 text-xs">
              <Award className="w-3.5 h-3.5" />
              <span>Verify Certificate</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
