"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { CourseListItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { BookOpen, Search } from "lucide-react";
import { CourseCard } from "@/components/course/CourseCard";

export default function CoursesCatalogPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchApi<CourseListItem[]>("/api/courses");
        setCourses(data);
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.course_code.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructor_name &&
        c.instructor_name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-0.5">
            Academic Catalog
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            ECE Online Courses
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Structured course curricula offered by the Department of Electronics
            Engineering.
          </p>
        </div>

        {/* Search */}
        <div className="w-full md:w-72 relative">
          <Input
            placeholder="Search by title, code, instructor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-border-subtle p-8 space-y-3">
          <BookOpen className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-sm font-semibold text-text-primary">
            No matching courses found
          </h3>
          <p className="text-xs text-text-secondary">
            Try modifying your search criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              certificateLabel="Verified Certificate"
            />
          ))}
        </div>
      )}
    </div>
  );
}
