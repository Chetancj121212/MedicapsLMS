"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BookOpen,
  Plus,
  Settings,
  ArrowLeft,
  Edit3,
  Trash2,
} from "lucide-react";

interface AdminCourseItem {
  id: number;
  course_code: string;
  title: string;
  short_description?: string;
  instructor_name?: string;
  estimated_duration?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  created_at: string;
  module_count: number;
  lecture_count: number;
  quiz_count: number;
  enrolled_count: number;
  certificates_count: number;
}

export default function AdminCoursesListPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit course state
  const [editingCourse, setEditingCourse] = useState<AdminCourseItem | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editInstructor, setEditInstructor] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStatus, setEditStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // New course form state
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newInstructor, setNewInstructor] = useState("Dr. S. K. Sharma (Professor, ECE)");
  const [newDuration, setNewDuration] = useState("8 Weeks");

  const loadCourses = React.useCallback(async () => {
    try {
      const data = await fetchApi<AdminCourseItem[]>("/api/admin/courses");
      setCourses(data);
    } catch (err) {
      console.error("Failed to load admin courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/courses");
      return;
    }
    if (!authLoading && user && user.role === "STUDENT") {
      router.push("/student");
      return;
    }

    if (user && user.role !== "STUDENT") {
      loadCourses();
    }
  }, [user, authLoading, router, loadCourses]);

  const handleStartEdit = (course: AdminCourseItem) => {
    setEditingCourse(course);
    setEditCode(course.course_code);
    setEditTitle(course.title);
    setEditDesc(course.short_description || "");
    setEditInstructor(course.instructor_name || "");
    setEditDuration(course.estimated_duration || "8 Weeks");
    setEditStatus(course.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    setUpdating(true);
    try {
      await fetchApi(`/api/admin/courses/${editingCourse.id}`, {
        method: "PUT",
        body: JSON.stringify({
          course_code: editCode.trim(),
          title: editTitle.trim(),
          short_description: editDesc.trim(),
          instructor_name: editInstructor.trim(),
          estimated_duration: editDuration.trim(),
          status: editStatus,
        }),
      });
      setEditingCourse(null);
      await loadCourses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update course");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCourse = async (course: AdminCourseItem) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete course "${course.course_code}: ${course.title}"?\n\nThis will remove all modules, video lectures, quizzes, and associated student progress.`
      )
    ) {
      return;
    }

    setDeletingId(course.id);
    try {
      await fetchApi(`/api/admin/courses/${course.id}`, {
        method: "DELETE",
      });
      await loadCourses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete course");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newTitle) return;

    setCreating(true);
    try {
      const created = await fetchApi("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          course_code: newCode.trim(),
          title: newTitle.trim(),
          short_description: newDesc.trim(),
          instructor_name: newInstructor.trim(),
          estimated_duration: newDuration.trim(),
        }),
      });

      setShowCreateModal(false);
      router.push(`/admin/courses/${(created as { id: string }).id}/builder`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link href="/admin" className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            Course Management & Builder
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Create, edit, upload video lectures, configure quizzes, and publish academic courses.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary-dark text-white gap-2 font-medium shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create New Course</span>
        </Button>
      </div>

      {/* Courses List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8 space-y-4">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No Courses Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by creating your first academic course offering for the ECE department.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>Create Course</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 hover:shadow-xs transition-all border-border-subtle"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {course.course_code}
                  </Badge>
                  <Badge
                    variant={
                      course.status === "PUBLISHED"
                        ? "success"
                        : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {course.status}
                  </Badge>
                </div>

                <h3 className="text-base font-semibold text-text-primary leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-text-secondary line-clamp-1">
                  {course.short_description || "No description provided."}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary pt-1">
                  {course.instructor_name && <span>Instructor: {course.instructor_name}</span>}
                  <span>&bull;</span>
                  <span>{course.module_count} Modules</span>
                  <span>&bull;</span>
                  <span>{course.lecture_count} Lectures</span>
                  <span>&bull;</span>
                  <span>{course.quiz_count} Quizzes</span>
                  <span>&bull;</span>
                  <span className="font-medium text-text-primary">{course.enrolled_count} Enrolled</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link href={`/admin/courses/${course.id}/builder`}>
                  <Button size="sm" className="bg-primary hover:bg-primary-dark text-white gap-1.5 h-8 text-xs">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Builder</span>
                  </Button>
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartEdit(course)}
                  className="gap-1.5 h-8 text-xs text-slate-700 hover:text-primary"
                  title="Edit Course Metadata"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteCourse(course)}
                  isLoading={deletingId === course.id}
                  className="gap-1.5 h-8 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                  title="Delete Course"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </Button>

                <Link href={`/courses/${course.id}`} target="_blank">
                  <Button size="sm" variant="ghost" title="Public Preview" className="h-8 text-xs text-slate-500">
                    Preview &rarr;
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Modal: Create Course Dialog ─────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create New Course</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Course Code *</label>
                <Input
                  placeholder="e.g. ECE-401"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="text-sm uppercase font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Course Title *</label>
                <Input
                  placeholder="e.g. Digital Signal Processing"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">Short Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary for catalog card..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Instructor Name</label>
                  <Input
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Duration</label>
                  <Input
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={creating} className="bg-primary text-white">
                  Create Course & Launch Builder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Course Dialog ───────────────────────────────────────── */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Course Details</h3>
                <p className="text-xs text-slate-500 font-mono">{editingCourse.course_code}</p>
              </div>
              <button
                onClick={() => setEditingCourse(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Course Code *</label>
                  <Input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="text-sm uppercase font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Publishing Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED")}
                    className="w-full rounded-lg border border-border-subtle p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="DRAFT">DRAFT (Hidden)</option>
                    <option value="PUBLISHED">PUBLISHED (Live)</option>
                    <option value="ARCHIVED">ARCHIVED (Locked)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Course Title *</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">Short Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Instructor Name</label>
                  <Input
                    value={editInstructor}
                    onChange={(e) => setEditInstructor(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Estimated Duration</label>
                  <Input
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button type="button" variant="outline" onClick={() => setEditingCourse(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={updating} className="bg-primary text-white">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
