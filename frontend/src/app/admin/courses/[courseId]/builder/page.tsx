"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchApi, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Plus,
  Video,
  FileQuestion,
  Layers,
  ArrowLeft,
  Save,
  Globe,
  Edit3,
  Trash2,
  ListOrdered,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface QuizOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
}

interface QuizQuestion {
  id?: number;
  question_text: string;
  question_type: string;
  marks?: number;
  explanation: string;
  options: QuizOption[];
}

interface BuilderLecture {
  id: number;
  title: string;
  description?: string;
  completion_threshold: number;
  duration: number;
  video_path?: string;
  video_source_type?: "youtube" | "google_drive" | "local";
  video_source_url?: string;
}

interface BuilderQuiz {
  id: number;
  title: string;
  description?: string;
  passing_percentage: number;
  max_attempts?: number;
  randomize_questions?: boolean;
  questions?: QuizQuestion[];
}

interface BuilderModule {
  id: number;
  title: string;
  description?: string;
  lectures?: BuilderLecture[];
  quizzes?: BuilderQuiz[];
}

interface BuilderCourse {
  id: number;
  course_code: string;
  title: string;
  short_description?: string;
  description?: string;
  instructor_name?: string;
  estimated_duration?: string;
  status: string;
  modules?: BuilderModule[];
}

export default function CourseBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<BuilderCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);

  // Modals state
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [showAddQuizModal, setShowAddQuizModal] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);

  // Add Module Form
  const [modTitle, setModTitle] = useState("");
  const [modDesc, setModDesc] = useState("");

  // Add Lecture Form (Section 12, 42)
  const [lecTitle, setLecTitle] = useState("");
  const [lecDesc, setLecDesc] = useState("");
  const [lecFile, setLecFile] = useState<File | null>(null);
  const [lecUrl, setLecUrl] = useState("");
  const [lecDuration, setLecDuration] = useState("300");
  const [lecThreshold, setLecThreshold] = useState("90");
  const [uploadingLec, setUploadingLec] = useState(false);
  const [isFetchingDuration, setIsFetchingDuration] = useState(false);
  const [durationAutoDetected, setDurationAutoDetected] = useState(false);

  // Directly extract duration from video File or URL
  const extractVideoDuration = (
    source: File | string,
    callback: (durationSec: number) => void,
  ) => {
    setIsFetchingDuration(true);
    try {
      const video = document.createElement("video");
      video.preload = "metadata";

      const url =
        typeof source === "string" ? source : URL.createObjectURL(source);

      const cleanup = () => {
        if (typeof source !== "string") {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        }
      };

      video.onloadedmetadata = () => {
        cleanup();
        setIsFetchingDuration(false);
        const dur = Math.round(video.duration);
        if (dur && !isNaN(dur) && dur > 0) {
          callback(dur);
        }
      };

      video.onerror = () => {
        cleanup();
        setIsFetchingDuration(false);
      };

      setTimeout(() => {
        cleanup();
        setIsFetchingDuration(false);
      }, 10000);

      video.src = url;
    } catch (err) {
      console.error("Failed to read video duration:", err);
      setIsFetchingDuration(false);
    }
  };

  const handleLecFileChange = (file: File | null) => {
    setLecFile(file);
    if (file) {
      extractVideoDuration(file, (seconds) => {
        setLecDuration(String(seconds));
        setDurationAutoDetected(true);
      });
    } else {
      setDurationAutoDetected(false);
    }
  };

  const handleLecUrlChange = (urlStr: string) => {
    setLecUrl(urlStr);
    if (!lecFile && urlStr.trim().startsWith("http")) {
      extractVideoDuration(urlStr.trim(), (seconds) => {
        setLecDuration(String(seconds));
        setDurationAutoDetected(true);
      });
    }
  };

  // Add Quiz Form (Section 14, 15)
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [quizPassPct, setQuizPassPct] = useState("100");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    {
      question_text: "",
      question_type: "MCQ",
      explanation: "",
      options: [
        { option_text: "", is_correct: true },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
      ],
    },
  ]);
  const [savingQuiz, setSavingQuiz] = useState(false);

  const loadCourse = useCallback(async () => {
    try {
      const data = (await fetchApi(
        `/api/admin/courses/${courseId}/builder`,
      )) as BuilderCourse;
      setCourse(data);
    } catch (err) {
      console.error("Failed to load course for builder:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // Delete Course
  const handleDeleteCurrentCourse = async () => {
    if (!course) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete course "${course.course_code}: ${course.title}"?\n\nThis will remove all modules, video lectures, and student records.`,
      )
    ) {
      return;
    }
    try {
      await fetchApi(`/api/admin/courses/${course.id}`, { method: "DELETE" });
      router.push("/admin/courses");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  // Module Edit & Delete State
  const [editingModule, setEditingModule] = useState<BuilderModule | null>(
    null,
  );
  const [editModTitle, setEditModTitle] = useState("");
  const [editModDesc, setEditModDesc] = useState("");
  const [savingEditMod, setSavingEditMod] = useState(false);

  const handleStartEditModule = (mod: BuilderModule) => {
    setEditingModule(mod);
    setEditModTitle(mod.title);
    setEditModDesc(mod.description || "");
  };

  const handleSaveEditModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule) return;
    setSavingEditMod(true);
    try {
      await fetchApi(`/api/admin/modules/${editingModule.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editModTitle.trim(),
          description: editModDesc.trim(),
        }),
      });
      setEditingModule(null);
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update module");
    } finally {
      setSavingEditMod(false);
    }
  };

  const handleDeleteModule = async (modId: number, title: string) => {
    if (
      !confirm(
        `Are you sure you want to delete module "${title}" and all its content?`,
      )
    )
      return;
    try {
      await fetchApi(`/api/admin/modules/${modId}`, { method: "DELETE" });
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete module");
    }
  };

  // Lecture Edit & Delete State
  const [editingLecture, setEditingLecture] = useState<BuilderLecture | null>(
    null,
  );
  const [editLecTitle, setEditLecTitle] = useState("");
  const [editLecDesc, setEditLecDesc] = useState("");
  const [editLecDuration, setEditLecDuration] = useState("300");
  const [editLecThreshold, setEditLecThreshold] = useState("90");
  const [editLecUrl, setEditLecUrl] = useState("");
  const [savingEditLec, setSavingEditLec] = useState(false);

  const handleStartEditLecture = (lec: BuilderLecture) => {
    setEditingLecture(lec);
    setEditLecTitle(lec.title);
    setEditLecDesc(lec.description || "");
    setEditLecDuration(String(lec.duration || 300));
    setEditLecThreshold(String(lec.completion_threshold || 90));
    setEditLecUrl(
      lec.video_source_url ||
        (lec.video_path?.startsWith("http") ? lec.video_path : ""),
    );
  };

  const handleSaveEditLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture) return;
    if (editLecUrl.trim()) {
      try {
        const parsed = new URL(editLecUrl.trim());
        const host = parsed.hostname.replace(/^www\./, "");
        const validYoutube =
          host === "youtube.com" ||
          host === "m.youtube.com" ||
          host === "youtu.be";
        const validDrive =
          host === "drive.google.com" &&
          (parsed.pathname.includes("/file/d/") || parsed.pathname === "/open");
        if (!validYoutube && !validDrive)
          throw new Error(
            "Unsupported video URL. Use a YouTube or Google Drive file URL.",
          );
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : "Enter a valid YouTube or Google Drive URL.",
        );
        return;
      }
    }
    setSavingEditLec(true);
    try {
      await fetchApi(`/api/admin/lectures/${editingLecture.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editLecTitle.trim(),
          description: editLecDesc.trim(),
          duration: parseFloat(editLecDuration) || 300,
          completion_threshold: parseFloat(editLecThreshold) || 90,
          video_source_url: editLecUrl.trim() || undefined,
        }),
      });
      setEditingLecture(null);
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update lecture");
    } finally {
      setSavingEditLec(false);
    }
  };

  const handleDeleteLecture = async (lecId: number, title: string) => {
    if (!confirm(`Are you sure you want to delete video lecture "${title}"?`))
      return;
    try {
      await fetchApi(`/api/admin/lectures/${lecId}`, { method: "DELETE" });
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete lecture");
    }
  };

  // Quiz Edit & Delete State
  const [editingQuiz, setEditingQuiz] = useState<BuilderQuiz | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState("");
  const [editQuizDesc, setEditQuizDesc] = useState("");
  const [editQuizPassPct, setEditQuizPassPct] = useState("100");
  const [savingEditQuiz, setSavingEditQuiz] = useState(false);

  const handleStartEditQuiz = (qz: BuilderQuiz) => {
    setEditingQuiz(qz);
    setEditQuizTitle(qz.title);
    setEditQuizDesc(qz.description || "");
    setEditQuizPassPct(String(qz.passing_percentage || 100));
  };

  const handleSaveEditQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz) return;
    setSavingEditQuiz(true);
    try {
      await fetchApi(`/api/admin/quizzes/${editingQuiz.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editQuizTitle.trim(),
          description: editQuizDesc.trim(),
          passing_percentage: parseFloat(editQuizPassPct) || 100,
        }),
      });
      setEditingQuiz(null);
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update quiz");
    } finally {
      setSavingEditQuiz(false);
    }
  };

  const handleDeleteQuiz = async (quizId: number, title: string) => {
    if (
      !confirm(
        `Are you sure you want to delete quiz "${title}" and all its questions?`,
      )
    )
      return;
    try {
      await fetchApi(`/api/admin/quizzes/${quizId}`, { method: "DELETE" });
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete quiz");
    }
  };

  // Manage Questions for a Quiz
  const [managingQuiz, setManagingQuiz] = useState<BuilderQuiz | null>(null);
  const [quizQuestionsList, setQuizQuestionsList] = useState<QuizQuestion[]>(
    [],
  );
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showAddQForm, setShowAddQForm] = useState(false);
  const [newQText, setNewQText] = useState("");
  const [newQType] = useState("MCQ");
  const [newQExplanation, setNewQExplanation] = useState("");
  const [newQOptions, setNewQOptions] = useState<QuizOption[]>([
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
  ]);
  const [addingQ, setAddingQ] = useState(false);

  const handleManageQuizQuestions = async (qz: BuilderQuiz) => {
    setManagingQuiz(qz);
    setLoadingQuestions(true);
    setShowAddQForm(false);
    try {
      const data = await fetchApi<{ questions?: QuizQuestion[] }>(
        `/api/admin/quizzes/${qz.id}`,
      );
      setQuizQuestionsList(data.questions || []);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await fetchApi(`/api/admin/questions/${qId}`, { method: "DELETE" });
      setQuizQuestionsList((prev) => prev.filter((q) => q.id !== qId));
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete question");
    }
  };

  const handleCreateNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingQuiz || !newQText.trim()) return;
    setAddingQ(true);
    try {
      await fetchApi(`/api/admin/quizzes/${managingQuiz.id}/questions`, {
        method: "POST",
        body: JSON.stringify({
          question_text: newQText.trim(),
          question_type: newQType,
          marks: 1.0,
          explanation: newQExplanation.trim(),
          options: newQOptions.map((o, idx) => ({
            option_text: o.option_text.trim(),
            is_correct: o.is_correct,
            order_index: idx + 1,
          })),
        }),
      });
      // Reload questions
      const data = await fetchApi<{ questions?: QuizQuestion[] }>(
        `/api/admin/quizzes/${managingQuiz.id}`,
      );
      setQuizQuestionsList(data.questions || []);
      setNewQText("");
      setNewQExplanation("");
      setNewQOptions([
        { option_text: "", is_correct: true },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
      ]);
      setShowAddQForm(false);
      await loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setAddingQ(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/admin/courses/${courseId}/builder`);
    }
  }, [user, authLoading, courseId, router]);

  useEffect(() => {
    if (user && user.role !== "STUDENT" && courseId) {
      void Promise.resolve().then(loadCourse);
    }
  }, [user, courseId, loadCourse]);

  const handleUpdateCourseDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setSavingCourse(true);
    try {
      await fetchApi(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: course.title,
          course_code: course.course_code,
          short_description: course.short_description,
          description: course.description,
          instructor_name: course.instructor_name,
          estimated_duration: course.estimated_duration,
          status: course.status,
        }),
      });
      alert("Course details updated successfully!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update course");
    } finally {
      setSavingCourse(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!course) return;
    const newStatus = course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await fetchApi(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setCourse({ ...course, status: newStatus });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modTitle) return;
    try {
      await fetchApi(`/api/admin/courses/${course!.id}/modules`, {
        method: "POST",
        body: JSON.stringify({
          title: modTitle.trim(),
          description: modDesc.trim(),
        }),
      });
      setShowAddModuleModal(false);
      setModTitle("");
      setModDesc("");
      loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create module");
    }
  };

  const handleUploadLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !lecTitle) return;
    if (!lecFile && !lecUrl.trim()) {
      alert("Provide an MP4 file or a YouTube/Google Drive video URL.");
      return;
    }
    if (!lecFile) {
      try {
        const parsed = new URL(lecUrl.trim());
        const host = parsed.hostname.replace(/^www\./, "");
        const isYoutube =
          host === "youtube.com" ||
          host === "m.youtube.com" ||
          host === "youtu.be";
        const isDrive =
          host === "drive.google.com" &&
          (parsed.pathname.match(/\/file\/d\/[^/]+/) !== null ||
            parsed.pathname === "/open");
        if (!isYoutube && !isDrive)
          throw new Error(
            "Unsupported video URL. Use a YouTube or Google Drive file URL.",
          );
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : "Enter a valid YouTube or Google Drive URL.",
        );
        return;
      }
    }

    setUploadingLec(true);
    try {
      const formData = new FormData();
      formData.append("title", lecTitle);
      formData.append("description", lecDesc);
      const finalDuration =
        lecDuration && parseInt(lecDuration, 10) > 0 ? lecDuration : "300";
      formData.append("duration", finalDuration);
      formData.append("completion_threshold", lecThreshold);

      if (lecFile) {
        formData.append("video_file", lecFile);
      } else if (lecUrl) {
        formData.append("video_url_path", lecUrl);
      }

      await fetchApi(`/api/admin/modules/${activeModuleId}/lectures`, {
        method: "POST",
        body: formData,
      });

      setShowAddLectureModal(false);
      setLecTitle("");
      setLecDesc("");
      setLecFile(null);
      setLecUrl("");
      setLecDuration("300");
      setDurationAutoDetected(false);
      setIsFetchingDuration(false);
      loadCourse();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to upload video lecture",
      );
    } finally {
      setUploadingLec(false);
    }
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !quizTitle) return;

    setSavingQuiz(true);
    try {
      // 1. Create Quiz
      const createdQuiz = await fetchApi(
        `/api/admin/modules/${activeModuleId}/quizzes`,
        {
          method: "POST",
          body: JSON.stringify({
            title: quizTitle,
            description: quizDesc,
            passing_percentage: parseFloat(quizPassPct) || 100.0,
          }),
        },
      );

      // 2. Add Questions
      for (const q of quizQuestions) {
        if (!q.question_text.trim()) continue;
        await fetchApi(
          `/api/admin/quizzes/${(createdQuiz as { id: string }).id}/questions`,
          {
            method: "POST",
            body: JSON.stringify({
              question_text: q.question_text,
              question_type: q.question_type,
              marks: 1.0,
              explanation: q.explanation,
              options: q.options.map((o: QuizOption, idx: number) => ({
                option_text: o.option_text,
                is_correct: o.is_correct,
                order_index: idx + 1,
              })),
            }),
          },
        );
      }

      setShowAddQuizModal(false);
      setQuizTitle("");
      setQuizDesc("");
      loadCourse();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setSavingQuiz(false);
    }
  };

  const addQuestionBlock = () => {
    setQuizQuestions([
      ...quizQuestions,
      {
        question_text: "",
        question_type: "MCQ",
        explanation: "",
        options: [
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false },
          { option_text: "", is_correct: false },
          { option_text: "", is_correct: false },
        ],
      },
    ]);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/admin/courses"
            className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Courses</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              Course Builder: {course.course_code}
            </h1>
            <Badge
              variant={course.status === "PUBLISHED" ? "success" : "secondary"}
              className="text-xs font-semibold"
            >
              {course.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleDeleteCurrentCourse}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            <span>Delete Course</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleTogglePublish}
            className={
              course.status === "PUBLISHED"
                ? "text-amber-700 border-amber-300"
                : "text-emerald-700 border-emerald-300"
            }
          >
            <Globe className="w-4 h-4 mr-1.5" />
            <span>
              {course.status === "PUBLISHED"
                ? "Unpublish to Draft"
                : "Publish Course Live"}
            </span>
          </Button>

          <Link href={`/courses/${course.id}`} target="_blank">
            <Button variant="ghost" size="sm">
              Public Preview &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── 1. Course Information Section (Section 28) ───────────────────────── */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 py-4">
          <CardTitle className="text-base font-bold text-slate-800">
            Course Metadata & Details
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleUpdateCourseDetails}>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Course Code</label>
                <Input
                  value={course.course_code}
                  onChange={(e) =>
                    setCourse({ ...course, course_code: e.target.value })
                  }
                  className="font-mono text-sm uppercase"
                  required
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="font-bold text-slate-700">Course Title</label>
                <Input
                  value={course.title}
                  onChange={(e) =>
                    setCourse({ ...course, title: e.target.value })
                  }
                  className="text-sm font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Course Instructor
                </label>
                <Input
                  value={course.instructor_name || ""}
                  onChange={(e) =>
                    setCourse({ ...course, instructor_name: e.target.value })
                  }
                  className="text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Estimated Duration
                </label>
                <Input
                  value={course.estimated_duration || ""}
                  onChange={(e) =>
                    setCourse({ ...course, estimated_duration: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Short Description
              </label>
              <Input
                value={course.short_description || ""}
                onChange={(e) =>
                  setCourse({ ...course, short_description: e.target.value })
                }
                className="text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                isLoading={savingCourse}
                className="bg-primary text-white"
              >
                <Save className="w-4 h-4 mr-1.5" />
                <span>Save Course Information</span>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* ─── 2. Course Curriculum Editor (Section 28) ─────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Course Curriculum
            </h2>
            <p className="text-xs text-slate-500">
              Add modules, video lectures, and 100% passing quizzes.
            </p>
          </div>

          <Button
            onClick={() => setShowAddModuleModal(true)}
            size="sm"
            className="bg-[#142250] text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Module</span>
          </Button>
        </div>

        {course.modules?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 p-8 space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">
              No Modules Yet
            </h3>
            <p className="text-xs text-slate-500">
              Create your first module to begin adding video lectures.
            </p>
            <Button onClick={() => setShowAddModuleModal(true)} size="sm">
              Add Module 1
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {course.modules?.map((mod: BuilderModule, idx: number) => (
              <Card
                key={mod.id}
                className="border-slate-200 overflow-hidden shadow-xs"
              >
                {/* Module Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Module {idx + 1}
                    </span>
                    <h3 className="text-base font-semibold text-text-primary">
                      {mod.title}
                    </h3>
                    {mod.description && (
                      <p className="text-xs text-slate-500">
                        {mod.description}
                      </p>
                    )}
                  </div>

                  {/* Content & Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveModuleId(mod.id);
                        setLecTitle("");
                        setLecDesc("");
                        setLecFile(null);
                        setLecUrl("");
                        setLecDuration("");
                        setDurationAutoDetected(false);
                        setIsFetchingDuration(false);
                        setShowAddLectureModal(true);
                      }}
                      className="gap-1.5 text-xs text-blue-900 border-blue-200 hover:bg-blue-50 h-8"
                    >
                      <Video className="w-3.5 h-3.5 text-blue-700" />
                      <span>+ Lecture</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveModuleId(mod.id);
                        setShowAddQuizModal(true);
                      }}
                      className="gap-1.5 text-xs text-amber-900 border-amber-200 hover:bg-amber-50 h-8"
                    >
                      <FileQuestion className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Quiz</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEditModule(mod)}
                      className="h-8 text-xs text-slate-700 hover:text-primary px-2"
                      title="Edit Module Title/Description"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteModule(mod.id, mod.title)}
                      className="h-8 text-xs text-rose-600 hover:bg-rose-50 px-2"
                      title="Delete Module"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Module Content List */}
                <CardContent className="p-4 divide-y divide-slate-100">
                  {mod.lectures?.length === 0 && mod.quizzes?.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No lectures or quizzes in this module. Click{" "}
                      {'"+ Video Lecture"'} or {'"+ Quiz"'} above.
                    </div>
                  ) : (
                    <>
                      {/* Video Lectures */}
                      {mod.lectures?.map(
                        (lec: BuilderLecture, lIdx: number) => (
                          <div
                            key={`lec-${lec.id}`}
                            className="py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded bg-primary/8 text-primary flex items-center justify-center font-semibold text-[11px] shrink-0">
                                L{lIdx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-text-primary truncate">
                                  {lec.title}
                                </div>
                                <div className="text-[11px] text-text-muted font-mono">
                                  Threshold: {lec.completion_threshold}% watched
                                  &bull; Duration: {lec.duration}s (
                                  {formatDuration(lec.duration)})
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="secondary"
                                className="font-mono text-[10px] hidden sm:inline-flex"
                              >
                                {lec.video_source_type === "google_drive"
                                  ? "Google Drive"
                                  : lec.video_source_type === "youtube"
                                    ? "YouTube"
                                    : "MP4 Lecture"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEditLecture(lec)}
                                className="h-7 text-[11px] text-slate-600 hover:text-primary px-2"
                                title="Edit Lecture"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleDeleteLecture(lec.id, lec.title)
                                }
                                className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 px-2"
                                title="Delete Lecture"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ),
                      )}

                      {/* Quizzes */}
                      {mod.quizzes?.map((qz: BuilderQuiz) => (
                        <div
                          key={`qz-${qz.id}`}
                          className="py-3 flex items-center justify-between gap-3 text-xs bg-[#F7F8FA] border border-border-subtle px-3 rounded-lg my-1.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded bg-primary/8 text-primary flex items-center justify-center font-semibold text-[11px] shrink-0">
                              Q
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-text-primary truncate">
                                {qz.title}
                              </div>
                              <div className="text-[11px] text-text-secondary">
                                Pass Requirement: {qz.passing_percentage}%
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManageQuizQuestions(qz)}
                              className="h-7 text-[11px] text-indigo-700 border-indigo-200 hover:bg-indigo-50 px-2.5 gap-1 font-medium"
                              title="Manage Questions in Quiz"
                            >
                              <ListOrdered className="w-3 h-3" />
                              <span>Questions</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditQuiz(qz)}
                              className="h-7 text-[11px] text-slate-600 hover:text-primary px-2"
                              title="Edit Quiz Details"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteQuiz(qz.id, qz.title)}
                              className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 px-2"
                              title="Delete Quiz"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modal: Add Module ────────────────────────────────────────────────── */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Add New Course Module
            </h3>
            <form onSubmit={handleCreateModule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Module Title *
                </label>
                <Input
                  placeholder="e.g. Module 2 — Microcontrollers"
                  value={modTitle}
                  onChange={(e) => setModTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Module Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of this module's topics..."
                  value={modDesc}
                  onChange={(e) => setModDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModuleModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-white">
                  Add Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Add Video Lecture (Section 12, 42) ─────────────────────────── */}
      {showAddLectureModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-700" />
                <span>Add Video Lecture to Module</span>
              </h3>
              <p className="text-xs text-slate-500">
                Upload MP4 video lecture (stored locally per Section 3 & 42).
              </p>
            </div>

            <form onSubmit={handleUploadLecture} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Lecture Title *
                </label>
                <Input
                  placeholder="e.g. GPIO and Timers"
                  value={lecTitle}
                  onChange={(e) => setLecTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Lecture notes and summary..."
                  value={lecDesc}
                  onChange={(e) => setLecDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* MP4 File Upload */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-text-primary">
                    Upload MP4 Video File
                  </label>
                  {isFetchingDuration && (
                    <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      Reading video duration...
                    </span>
                  )}
                </div>
                <div className="border border-dashed border-border-subtle rounded-lg p-4 text-center hover:bg-[#F7F8FA] transition-colors">
                  <input
                    type="file"
                    accept=".mp4,video/mp4"
                    onChange={(e) =>
                      handleLecFileChange(e.target.files?.[0] || null)
                    }
                    className="block w-full text-xs text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/8 file:text-primary hover:file:bg-primary/15 cursor-pointer"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    {lecFile
                      ? `Selected: ${lecFile.name}`
                      : "Upload local .mp4 file to auto-detect length"}
                  </p>
                </div>
              </div>

              {/* Or Video URL Fallback */}
              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Or Direct Video URL (Optional)
                </label>
                <Input
                  placeholder="https://.../video.mp4"
                  value={lecUrl}
                  onChange={(e) => handleLecUrlChange(e.target.value)}
                  onBlur={() => {
                    if (!lecFile && lecUrl.trim().startsWith("http")) {
                      extractVideoDuration(lecUrl.trim(), (sec) => {
                        setLecDuration(String(sec));
                        setDurationAutoDetected(true);
                      });
                    }
                  }}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-text-primary">
                      Duration (Seconds)
                    </label>
                    {durationAutoDetected && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-detected
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder="Auto-filled from video"
                    value={lecDuration}
                    onChange={(e) => {
                      setLecDuration(e.target.value);
                      setDurationAutoDetected(false);
                    }}
                    className="text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-500">
                    {lecDuration && parseInt(lecDuration, 10) > 0 ? (
                      <>
                        Equivalent:{" "}
                        <span className="font-semibold text-slate-700">
                          {formatDuration(parseInt(lecDuration, 10))}
                        </span>{" "}
                        (mm:ss)
                      </>
                    ) : (
                      "Selecting a video will auto-fetch length"
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-text-primary">
                    Completion Threshold (%)
                  </label>
                  <Input
                    type="number"
                    value={lecThreshold}
                    onChange={(e) => setLecThreshold(e.target.value)}
                    className="text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-500">
                    Required watch percentage (default 90%)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddLectureModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={uploadingLec}
                  className="bg-primary text-white font-semibold"
                >
                  Upload & Add to Curriculum
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Add Quiz (Section 14, 15) ──────────────────────────────────── */}
      {showAddQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-border-subtle max-h-[90vh] overflow-y-auto">
            <div className="border-b border-border-subtle pb-3">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-primary" />
                <span>Create Module Assessment / Quiz</span>
              </h3>
              <p className="text-xs text-slate-500">
                Configure quiz parameters and add MCQ or True/False questions.
              </p>
            </div>

            <form onSubmit={handleSaveQuiz} className="space-y-5 text-xs">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="font-bold text-slate-700">
                    Quiz Title *
                  </label>
                  <Input
                    placeholder="e.g. Module Assessment: Microcontrollers"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Passing (%)
                  </label>
                  <Input
                    type="number"
                    value={quizPassPct}
                    onChange={(e) => setQuizPassPct(e.target.value)}
                    className="text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {/* Questions Builder */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-sm">
                    Questions ({quizQuestions.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addQuestionBlock}
                  >
                    Add Question
                  </Button>
                </div>

                {quizQuestions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        Question {qIdx + 1}
                      </span>
                      <select
                        value={q.question_type}
                        onChange={(e) => {
                          const updated = [...quizQuestions];
                          updated[qIdx].question_type = e.target.value;
                          if (e.target.value === "TRUE_FALSE") {
                            updated[qIdx].options = [
                              { option_text: "True", is_correct: true },
                              { option_text: "False", is_correct: false },
                            ];
                          }
                          setQuizQuestions(updated);
                        }}
                        className="text-xs border rounded p-1 font-semibold"
                      >
                        <option value="MCQ">Multiple Choice (MCQ)</option>
                        <option value="TRUE_FALSE">True / False</option>
                      </select>
                    </div>

                    <Input
                      placeholder="Type the question text here..."
                      value={q.question_text}
                      onChange={(e) => {
                        const updated = [...quizQuestions];
                        updated[qIdx].question_text = e.target.value;
                        setQuizQuestions(updated);
                      }}
                      className="text-sm font-medium bg-white"
                      required
                    />

                    {/* Options */}
                    <div className="space-y-2 pl-2">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Answer Options (Select the correct answer radio):
                      </div>
                      {q.options.map((opt: QuizOption, optIdx: number) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={opt.is_correct}
                            onChange={() => {
                              const updated = [...quizQuestions];
                              updated[qIdx].options.forEach(
                                (o: QuizOption, i: number) => {
                                  o.is_correct = i === optIdx;
                                },
                              );
                              setQuizQuestions(updated);
                            }}
                            className="w-4 h-4 text-emerald-600 accent-emerald-600 shrink-0"
                          />
                          <Input
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt.option_text}
                            onChange={(e) => {
                              const updated = [...quizQuestions];
                              updated[qIdx].options[optIdx].option_text =
                                e.target.value;
                              setQuizQuestions(updated);
                            }}
                            className="text-xs bg-white h-8"
                            required
                          />
                        </div>
                      ))}
                    </div>

                    <Input
                      placeholder="Explanation hint (shown after failed attempt)..."
                      value={q.explanation}
                      onChange={(e) => {
                        const updated = [...quizQuestions];
                        updated[qIdx].explanation = e.target.value;
                        setQuizQuestions(updated);
                      }}
                      className="text-xs bg-white text-slate-600"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddQuizModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingQuiz}
                  className="bg-primary text-white font-semibold"
                >
                  Save Assessment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Module Dialog ────────────────────────────────────────── */}
      {editingModule && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Module
              </h3>
              <button
                onClick={() => setEditingModule(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditModule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Module Title *
                </label>
                <Input
                  value={editModTitle}
                  onChange={(e) => setEditModTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Module Description
                </label>
                <textarea
                  rows={2}
                  value={editModDesc}
                  onChange={(e) => setEditModDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingModule(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingEditMod}
                  className="bg-primary text-white"
                >
                  Save Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Lecture Dialog ───────────────────────────────────────── */}
      {editingLecture && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Video Lecture
              </h3>
              <button
                onClick={() => setEditingLecture(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveEditLecture}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Lecture Title *
                </label>
                <Input
                  value={editLecTitle}
                  onChange={(e) => setEditLecTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editLecDesc}
                  onChange={(e) => setEditLecDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  YouTube or Google Drive URL
                </label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/.../view"
                  value={editLecUrl}
                  onChange={(e) => setEditLecUrl(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      Duration (Seconds)
                    </label>
                    {editingLecture?.video_path && (
                      <button
                        type="button"
                        onClick={() => {
                          const path = editingLecture.video_path;
                          if (!path) return;

                          const url = path.startsWith("http")
                            ? path
                            : `${API_BASE}${path}`;
                          extractVideoDuration(url, (dur) =>
                            setEditLecDuration(String(dur)),
                          );
                        }}
                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        title="Re-read duration from video file"
                      >
                        <Sparkles className="w-3 h-3" />
                        Re-fetch from video
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={editLecDuration}
                    onChange={(e) => setEditLecDuration(e.target.value)}
                    className="text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-500">
                    Equivalent:{" "}
                    {formatDuration(parseInt(editLecDuration, 10) || 0)} (mm:ss)
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Watch Threshold (%)
                  </label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={editLecThreshold}
                    onChange={(e) => setEditLecThreshold(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLecture(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingEditLec}
                  className="bg-primary text-white"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Quiz Dialog ──────────────────────────────────────────── */}
      {editingQuiz && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Quiz Settings
              </h3>
              <button
                onClick={() => setEditingQuiz(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditQuiz} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Quiz Title *</label>
                <Input
                  value={editQuizTitle}
                  onChange={(e) => setEditQuizTitle(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editQuizDesc}
                  onChange={(e) => setEditQuizDesc(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Passing Requirement (%)
                </label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={editQuizPassPct}
                  onChange={(e) => setEditQuizPassPct(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingQuiz(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingEditQuiz}
                  className="bg-primary text-white"
                >
                  Save Quiz
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Manage Questions Dialog ───────────────────────────────────── */}
      {managingQuiz && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Manage Questions
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Quiz: {managingQuiz.title}
                </p>
              </div>
              <button
                onClick={() => setManagingQuiz(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  Total Questions: {quizQuestionsList.length}
                </span>
                <Button
                  size="sm"
                  onClick={() => setShowAddQForm(!showAddQForm)}
                  className="bg-primary text-white text-xs h-8"
                >
                  {showAddQForm ? "Close Form" : " Question"}
                </Button>
              </div>

              {/* Add Question Inline Form */}
              {showAddQForm && (
                <form
                  onSubmit={handleCreateNewQuestion}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                >
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                    New Question
                  </h4>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Question Text *
                    </label>
                    <Input
                      placeholder="e.g. Which layer of the OSI model handles routing?"
                      value={newQText}
                      onChange={(e) => setNewQText(e.target.value)}
                      className="text-xs bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Options (Select radio for correct answer)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {newQOptions.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200"
                        >
                          <input
                            type="radio"
                            name="newQCorrect"
                            checked={opt.is_correct}
                            onChange={() => {
                              const updated = newQOptions.map((o, i) => ({
                                ...o,
                                is_correct: i === oIdx,
                              }));
                              setNewQOptions(updated);
                            }}
                            className="w-4 h-4 text-emerald-600 accent-emerald-600 shrink-0"
                          />
                          <Input
                            placeholder={`Option ${oIdx + 1}`}
                            value={opt.option_text}
                            onChange={(e) => {
                              const updated = [...newQOptions];
                              updated[oIdx].option_text = e.target.value;
                              setNewQOptions(updated);
                            }}
                            className="text-xs h-7 border-0 p-0 focus:ring-0"
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-600">
                      Explanation Hint (Shown on wrong answer)
                    </label>
                    <Input
                      placeholder="e.g. Network layer (Layer 3) handles routing..."
                      value={newQExplanation}
                      onChange={(e) => setNewQExplanation(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddQForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      isLoading={addingQ}
                      className="bg-emerald-700 text-white"
                    >
                      Save Question
                    </Button>
                  </div>
                </form>
              )}

              {/* Questions List */}
              {loadingQuestions ? (
                <div className="py-8 text-center text-slate-400">
                  Loading questions...
                </div>
              ) : quizQuestionsList.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No questions yet. Click &ldquo; Add Question&rdquo; above to
                  create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {quizQuestionsList.map((q: QuizQuestion, qIdx: number) => (
                    <div
                      key={q.id || qIdx}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold text-slate-900">
                          <span className="text-primary mr-1.5 font-bold">
                            Q{qIdx + 1}.
                          </span>
                          {q.question_text}
                        </div>
                        {q.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteQuestion(q.id!)}
                            className="text-rose-600 hover:bg-rose-50 h-7 px-2 shrink-0"
                            title="Delete this question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {q.options?.map((opt: QuizOption, oIdx: number) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-md text-xs flex items-center justify-between border ${
                              opt.is_correct
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium"
                                : "bg-slate-50 text-slate-700 border-slate-100"
                            }`}
                          >
                            <span>{opt.option_text}</span>
                            {opt.is_correct && (
                              <span className="text-[10px] text-emerald-700 font-bold ml-1">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="text-[11px] text-slate-500 italic pt-1">
                          Hint: {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 flex justify-end shrink-0 bg-slate-50">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setManagingQuiz(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
